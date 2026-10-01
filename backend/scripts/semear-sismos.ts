// Cria as estacoes simuladas do Japao e preenche as ultimas horas de leituras
// simuladas e importa os sismos do USGS. Pode rodar varias vezes.
// Uso: npm run sismos:semear

import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { EstacoesService } from '../src/sismos/estacoes.service';
import { SimuladorService } from '../src/sismos/simulador.service';
import { UsgsService } from '../src/sismos/usgs.service';
import { PrismaService } from '../src/prisma/prisma.service';

const SENSORES = [
  { tipo: 'SISMOGRAFO', nome: 'Sismógrafo' },
  { tipo: 'GPS', nome: 'Receptor GPS' },
  { tipo: 'TEMPERATURA', nome: 'Temperatura interna', sentido: 'INTERNO' },
  { tipo: 'TEMPERATURA', nome: 'Temperatura externa', sentido: 'EXTERNO' },
] as const;

const ESTACOES = [
  { codigo: 'JP-TOQUIO', nome: 'Tóquio', latitude: 35.68, longitude: 139.69, placa: 'OKHOTSK' },
  { codigo: 'JP-SENDAI', nome: 'Sendai', latitude: 38.27, longitude: 140.87, placa: 'OKHOTSK' },
  { codigo: 'JP-OSAKA', nome: 'Osaka', latitude: 34.69, longitude: 135.5, placa: 'AMUR' },
  { codigo: 'JP-FUKUOKA', nome: 'Fukuoka', latitude: 33.59, longitude: 130.4, placa: 'AMUR' },
];

async function semear() {
  // Sem agendador: o script faz o trabalho uma vez e termina.
  process.env.SISMOS_AGENDADOR = 'false';
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
  try {
    const prisma = app.get(PrismaService);
    const estacoes = app.get(EstacoesService);

    for (const e of ESTACOES) {
      if (await prisma.estacao.findUnique({ where: { codigo: e.codigo } })) {
        console.log(`[=] ${e.nome} ja existe`);
        continue;
      }
      const criada = await estacoes.criar({ ...e, origem: 'SIMULADO', sensores: [...SENSORES] });
      console.log(`[+] ${e.nome} criada (chave de API, mostrada so agora: ${criada.chave})`);
    }

    console.log('[*] Preenchendo leituras simuladas das ultimas 12 horas...');
    console.log(`[+] ${await app.get(SimuladorService).preencherHistorico(12)} leituras simuladas`);

    console.log('[*] Importando sismos do USGS (Japao)...');
    console.log('[+]', await app.get(UsgsService).sincronizar());
  } finally {
    await app.close();
  }
}

semear().catch((erro) => {
  console.error(`[ERRO] ${erro.message}`);
  process.exit(1);
});