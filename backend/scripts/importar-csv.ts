// Importa o CSV para o banco. Pode rodar varias vezes (ignora ids que ja existem).
// Uso: npm run importar-csv [caminho/do/arquivo.csv]

import { PrismaClient } from '@prisma/client';
import { parse } from 'csv-parse/sync';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { removerIdsRepetidos, tratarLinha } from '../src/leituras/tratamento';

const TAMANHO_LOTE = 5000;

async function importar() {
  const caminho = resolve(process.argv[2] ?? '../data/temperature_readings.csv');
  console.log(`[*] Lendo ${caminho}`);

  const linhas: Record<string, string>[] = parse(readFileSync(caminho, 'utf-8'), {
    columns: true,
    skip_empty_lines: true,
    bom: true,
  });

  // Uma linha invalida aborta a carga inteira: nada entra pela metade.
  const leituras = removerIdsRepetidos(linhas.map((linha, i) => {
    try {
      return tratarLinha(linha);
    } catch (erro) {
      throw new Error(`Linha ${i + 2}: ${(erro as Error).message}`);
    }
  }));
  console.log(`[*] ${leituras.length} registros validos (de ${linhas.length} linhas)`);

  const prisma = new PrismaClient();
  try {
    // RN-03: toda carga do CSV pertence a estacao "legado" (criada pela migracao).
    const legado = await prisma.estacao.findUnique({ where: { codigo: 'LEGADO-SALA-ADMIN' } });
    if (!legado) throw new Error('Estacao legado nao encontrada. Rode as migrations (npm run prisma:migrar).');

    let inseridos = 0;
    for (let i = 0; i < leituras.length; i += TAMANHO_LOTE) {
      const lote = leituras.slice(i, i + TAMANHO_LOTE).map((l) => ({ ...l, estacaoId: legado.id }));
      const resultado = await prisma.leitura.createMany({ data: lote, skipDuplicates: true });
      inseridos += resultado.count;
    }
    console.log(`[SUCESSO] ${inseridos} registros novos inseridos (o restante ja existia).`);
  } finally {
    await prisma.$disconnect();
  }
}

importar().catch((erro) => {
  console.error(`[ERRO] ${erro.message}`);
  process.exit(1);
});
