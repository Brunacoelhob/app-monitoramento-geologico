import { execSync } from 'child_process';
import { PrismaClient } from '@prisma/client';

// Roda uma vez antes da suite: aplica as migrations no banco de TESTE e zera as tabelas.
// Nunca toca no banco de desenvolvimento: exige DATABASE_URL_TESTE e recusa nomes sem "test".
export default async function prepararBanco() {
  const url = process.env.DATABASE_URL_TESTE;
  if (!url) {
    throw new Error(
      'Defina DATABASE_URL_TESTE (um banco exclusivo para testes, ex.: postgresql://postgres:senha@127.0.0.1:55432/iot_test).',
    );
  }
  if (!/test/i.test(new URL(url).pathname)) {
    throw new Error('O banco de testes precisa ter "test" no nome, para nunca apagar o banco de desenvolvimento por engano.');
  }

  execSync('npx prisma migrate deploy', { env: { ...process.env, DATABASE_URL: url }, stdio: 'inherit' });

  const prisma = new PrismaClient({ datasources: { db: { url } } });
  try {
    const tabelas = await prisma.$queryRaw<{ tablename: string }[]>`
      SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
    if (tabelas.length) {
      const lista = tabelas.map((t) => `"${t.tablename}"`).join(', ');
      await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${lista} RESTART IDENTITY CASCADE`);
    }
  } finally {
    await prisma.$disconnect();
  }
}
