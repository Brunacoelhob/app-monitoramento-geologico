// Cria (ou atualiza a senha dos) usuarios iniciais a partir do .env.
// Nao existe cadastro publico na API: usuarios so nascem por aqui.

import { Papel, PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function garantirUsuario(prefixo: string, papel: Papel) {
  const email = process.env[`${prefixo}_EMAIL`]?.toLowerCase();
  const senha = process.env[`${prefixo}_SENHA`];
  if (!email || !senha) throw new Error(`Defina ${prefixo}_EMAIL e ${prefixo}_SENHA no .env.`);
  if (senha.length < 10) throw new Error(`${prefixo}_SENHA precisa ter pelo menos 10 caracteres.`);

  const senhaHash = await bcrypt.hash(senha, 10);
  await prisma.usuario.upsert({
    where: { email },
    update: { senhaHash, papel },
    create: { email, senhaHash, papel },
  });
  console.log(`[OK] ${papel}: ${email}`);
}

async function principal() {
  await garantirUsuario('ADMIN', Papel.ADMIN);
  await garantirUsuario('VISUALIZADOR', Papel.VISUALIZADOR);
}

principal()
  .catch((erro) => {
    console.error(`[ERRO] ${erro.message}`);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
