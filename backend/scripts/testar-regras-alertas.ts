// Verifica as regras de alerta (RN-13 a RN-22) contra o banco real.
// Cria sismos e estacoes de teste (codigo "TESTE-*"), confere o resultado e imprime os ids.
// Uso: npm run sismos:testar-regras            (cria e confere)
//      npm run sismos:testar-regras -- limpar  (remove os dados de teste)
process.env.SISMOS_AGENDADOR = 'false';

import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { AlertasService } from '../src/sismos/alertas.service';
import { EstacoesService } from '../src/sismos/estacoes.service';
import { IngestaoService } from '../src/sismos/ingestao.service';

let falhas = 0;
const conferir = (nome: string, ok: boolean, detalhe = '') => {
  if (!ok) falhas++;
  console.log(`${ok ? 'PASSOU' : 'FALHOU'}  ${nome}${detalhe ? '  -> ' + detalhe : ''}`);
};

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error'] });
  const prisma = app.get(PrismaService);
  const alertas = app.get(AlertasService);
  const estacoes = app.get(EstacoesService);
  const ingestao = app.get(IngestaoService);

  try {
    if (process.argv.includes('limpar')) {
      await prisma.alerta.deleteMany({ where: { OR: [{ evento: { idExterno: { startsWith: 'TESTE-' } } }, { estacao: { codigo: { startsWith: 'TESTE-' } } }] } });
      await prisma.eventoSismico.deleteMany({ where: { idExterno: { startsWith: 'TESTE-' } } });
      // Leituras de temperatura da estacao de teste (sem cascata) saem antes da estacao.
      await prisma.leitura.deleteMany({ where: { estacao: { codigo: { startsWith: 'TESTE-' } } } });
      await prisma.estacao.deleteMany({ where: { codigo: { startsWith: 'TESTE-' } } });
      console.log('dados de teste removidos');
      return;
    }

    const agora = Date.now();
    const evento = async (id: string, magnitude: number, lat: number, lon: number, minutosAtras: number) => {
      const e = await prisma.eventoSismico.create({
        data: { idExterno: id, magnitude, profundidadeKm: 10, latitude: lat, longitude: lon, local: 'Evento de teste', ocorridoEm: new Date(agora - minutosAtras * 60_000), origem: 'REAL', situacao: 'AUTOMATICO' },
      });
      await alertas.processarEvento(e);
      return prisma.eventoSismico.findUniqueOrThrow({ where: { id: e.id }, include: { alerta: true } });
    };

    // RN-13 e RN-16: principal M6,0 perto de Sendai -> alerta ALTO
    const principal = await evento('TESTE-PRINCIPAL', 6.0, 38.27, 140.87, 120);
    conferir('RN-13/16: M6,0 abre alerta ALTO', principal.alerta?.nivel === 'ALTO' && principal.alerta.estado === 'ABERTO');

    // RN-16: reprocessar o mesmo evento nao duplica
    await alertas.processarEvento(principal);
    await alertas.processarEvento(principal);
    conferir('RN-16: reprocessar nao duplica o alerta', (await prisma.alerta.count({ where: { eventoId: principal.id } })) === 1);

    // RN-21: M4,8, 6 km, 1 h depois -> replica, sem alerta proprio
    const replica = await evento('TESTE-REPLICA', 4.8, 38.3, 140.9, 60);
    conferir('RN-21: evento menor e proximo vira replica', replica.alertaReplicaId === principal.alerta!.id && replica.alerta === null);

    // RN-21: magnitude maior -> alerta novo
    const maior = await evento('TESTE-MAIOR', 6.3, 38.3, 140.9, 30);
    conferir('RN-21: magnitude maior gera alerta novo', maior.alerta?.nivel === 'ALTO' && maior.alertaReplicaId === null);

    // RN-21: longe (~250 km) -> alerta proprio
    const longe = await evento('TESTE-LONGE', 5.0, 36.0, 140.0, 20);
    conferir('RN-21: evento longe gera alerta proprio', longe.alerta?.nivel === 'ATENCAO');

    // RN-17: USGS revisa a magnitude -> reclassifica e guarda o nivel anterior
    const revisado = await prisma.eventoSismico.update({ where: { id: longe.id }, data: { magnitude: 5.7, situacao: 'REVISADO' } });
    await alertas.processarEvento(revisado);
    const aposRevisao = await prisma.alerta.findUniqueOrThrow({ where: { eventoId: longe.id } });
    conferir('RN-17: revisao reclassifica (ATENCAO -> ALTO) e guarda o anterior', aposRevisao.nivel === 'ALTO' && aposRevisao.nivelAnterior === 'ATENCAO');

    // RN-17: evento cancelado encerra o alerta automaticamente
    const cancelado = await prisma.eventoSismico.update({ where: { id: maior.id }, data: { situacao: 'CANCELADO' } });
    await alertas.processarEvento(cancelado);
    const aposCancelar = await prisma.alerta.findUniqueOrThrow({ where: { eventoId: maior.id } });
    conferir('RN-17: evento cancelado encerra o alerta', aposCancelar.estado === 'ENCERRADO' && aposCancelar.encerradoAutomatico === true, aposCancelar.motivoEncerramento ?? '');

    // RN-20: ATENCAO com mais de 72 h encerra sozinho; ALTO/CRITICO nunca
    const antigo = await evento('TESTE-ANTIGO-ATENCAO', 4.6, 35.0, 135.0, 80 * 60);
    const antigoAlto = await evento('TESTE-ANTIGO-ALTO', 5.8, 34.0, 132.0, 80 * 60);
    await alertas.encerrarAtencaoVencidos();
    const a1 = await prisma.alerta.findUniqueOrThrow({ where: { eventoId: antigo.id } });
    const a2 = await prisma.alerta.findUniqueOrThrow({ where: { eventoId: antigoAlto.id } });
    conferir('RN-20: ATENCAO com mais de 72 h encerra sozinho', a1.estado === 'ENCERRADO' && a1.encerradoAutomatico);
    conferir('RN-20: ALTO antigo continua aberto', a2.estado === 'ABERTO');

    // RN-22: estacao ativa e sem leituras ha mais de 15 min -> alerta; leitura restabelece
    const criada = await estacoes.criar({ codigo: 'TESTE-SILENCIO', nome: 'Estação de teste', latitude: 35, longitude: 139, origem: 'REAL', sensores: [{ tipo: 'SISMOGRAFO', nome: 'Sismógrafo' }] });
    await prisma.estacao.update({ where: { id: criada.id }, data: { criadaEm: new Date(agora - 20 * 60_000) } });
    await alertas.verificarSemComunicacao();
    const silencio = await prisma.alerta.findFirst({ where: { estacaoId: criada.id, tipo: 'SEM_COMUNICACAO', estado: { not: 'ENCERRADO' } } });
    conferir('RN-22: estacao sem leitura ha 20 min abre alerta', silencio?.nivel === 'ATENCAO');
    await alertas.verificarSemComunicacao();
    conferir('RN-22: nao abre um segundo alerta para a mesma estacao', (await prisma.alerta.count({ where: { estacaoId: criada.id, tipo: 'SEM_COMUNICACAO' } })) === 1);
    const estacao = await prisma.estacao.findUniqueOrThrow({ where: { id: criada.id } });
    const sensor = await prisma.sensor.findFirstOrThrow({ where: { estacaoId: criada.id } });
    const resultado = await ingestao.ingerir(estacao, [{ sensorId: sensor.id, instante: new Date(), amplitude: 0.05 }]);
    const aposLeitura = await prisma.alerta.findUniqueOrThrow({ where: { id: silencio!.id } });
    conferir('RN-22: a primeira leitura encerra o alerta de silencio', resultado.aceitas === 1 && aposLeitura.estado === 'ENCERRADO' && aposLeitura.encerradoAutomatico);

    // RN-03 e RN-22: a estacao legado nunca gera alerta de silencio
    const legado = await prisma.alerta.count({ where: { estacao: { codigo: 'LEGADO-SALA-ADMIN' } } });
    conferir('RN-22: estacao legado nao gera alerta de silencio', legado === 0);

    // RN-15: estacoes proximas no detalhe do alerta (Sendai esta a ~0 km do principal)
    const detalhe = await alertas.obter(principal.alerta!.id);
    conferir('RN-15: detalhe lista a estacao de Sendai como proxima', detalhe.estacoesProximas.some((e: { codigo: string }) => e.codigo === 'JP-SENDAI'), JSON.stringify(detalhe.estacoesProximas.map((e: { codigo: string; distanciaKm: number }) => `${e.codigo}:${e.distanciaKm}km`)));
    conferir('RN-21: detalhe traz a replica anexada', detalhe.replicas.length === 1);

    console.log('IDS ' + JSON.stringify({ alertaAberto: principal.alerta!.id, alertaParaEncerrar: (await prisma.alerta.findUniqueOrThrow({ where: { eventoId: longe.id } })).id }));
    console.log(falhas === 0 ? 'TODAS AS REGRAS OK' : `${falhas} REGRA(S) FALHARAM`);
  } finally {
    await app.close();
  }
}

main().catch((e) => { console.error('ERRO', e); process.exit(1); });
