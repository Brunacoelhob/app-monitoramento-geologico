import { Injectable } from '@nestjs/common';
import { Estacao, Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { AlertasService } from './alertas.service';
import { regras } from './config';
import { validarLeitura } from './regras';

export interface LeituraEntrada {
  sensorId: number;
  instante: string | Date;
  temperatura?: number;
  amplitude?: number;
  latitude?: number;
  longitude?: number;
  altitudeM?: number;
  deslocamentoLesteMm?: number;
  deslocamentoNorteMm?: number;
}

export interface ResultadoIngestao {
  aceitas: number;
  ignoradas: number; // repetidas (mesmo sensor e mesmo instante)
  rejeitadas: { indice: number; motivo: string }[];
}

// Recebe leituras de uma estacao (sensor real ou simulador), valida (RN-10, RN-11)
// e grava. A origem da leitura vem da estacao: REAL ou SIMULADO (RN-06).
@Injectable()
export class IngestaoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly alertas: AlertasService,
  ) {}

  async ingerir(estacao: Estacao, leituras: LeituraEntrada[]): Promise<ResultadoIngestao> {
    const cfg = regras();
    const agora = new Date();
    const sensores = new Map(
      (await this.prisma.sensor.findMany({ where: { estacaoId: estacao.id } })).map((s) => [s.id, s]),
    );

    const rejeitadas: ResultadoIngestao['rejeitadas'] = [];
    const sismografo: Prisma.LeituraSismografoCreateManyInput[] = [];
    const gps: Prisma.LeituraGpsCreateManyInput[] = [];
    const temperatura: { sentido: 'INTERNO' | 'EXTERNO'; dataLeitura: Date; valor: number }[] = [];

    leituras.forEach((leitura, indice) => {
      const sensor = sensores.get(leitura.sensorId);
      if (!sensor) return void rejeitadas.push({ indice, motivo: 'Este sensor não pertence à estação.' });
      if (!sensor.ativo) return void rejeitadas.push({ indice, motivo: 'Sensor inativo.' });

      const instante = new Date(leitura.instante);
      const motivo = validarLeitura(sensor.tipo, { ...leitura, instante }, agora, cfg);
      if (motivo) return void rejeitadas.push({ indice, motivo });

      switch (sensor.tipo) {
        case 'SISMOGRAFO':
          sismografo.push({ sensorId: sensor.id, instante, amplitude: leitura.amplitude!, origem: estacao.origem });
          break;
        case 'GPS':
          gps.push({
            sensorId: sensor.id,
            instante,
            latitude: leitura.latitude!,
            longitude: leitura.longitude!,
            altitudeM: leitura.altitudeM,
            deslocamentoLesteMm: leitura.deslocamentoLesteMm,
            deslocamentoNorteMm: leitura.deslocamentoNorteMm,
            origem: estacao.origem,
          });
          break;
        case 'TEMPERATURA':
          // A tabela de temperatura guarda segundos inteiros (mesma regra do CSV).
          temperatura.push({
            sentido: sensor.sentido as 'INTERNO' | 'EXTERNO',
            dataLeitura: new Date(Math.floor(instante.getTime() / 1000) * 1000),
            valor: Math.round(leitura.temperatura! * 10) / 10,
          });
          break;
      }
    });

    const inseridasSismo = sismografo.length
      ? (await this.prisma.leituraSismografo.createMany({ data: sismografo, skipDuplicates: true })).count
      : 0;
    const inseridasGps = gps.length
      ? (await this.prisma.leituraGps.createMany({ data: gps, skipDuplicates: true })).count
      : 0;
    const inseridasTemp = await this.gravarTemperaturas(estacao, temperatura);

    const aceitas = inseridasSismo + inseridasGps + inseridasTemp;
    const tentadas = sismografo.length + gps.length + temperatura.length;

    // RN-22: chegou leitura -> o alerta de silencio dessa estacao se encerra.
    if (aceitas > 0) await this.alertas.restabelecerComunicacao(estacao.id);

    return { aceitas, ignoradas: tentadas - aceitas, rejeitadas };
  }

  // Temperatura: mesma tabela do painel antigo. Ignora leitura repetida (estacao + sentido + instante).
  private async gravarTemperaturas(
    estacao: Estacao,
    lista: { sentido: 'INTERNO' | 'EXTERNO'; dataLeitura: Date; valor: number }[],
  ): Promise<number> {
    if (lista.length === 0) return 0;

    const existentes = await this.prisma.leitura.findMany({
      where: { estacaoId: estacao.id, dataLeitura: { in: lista.map((l) => l.dataLeitura) } },
      select: { sentido: true, dataLeitura: true },
    });
    const chaves = new Set(existentes.map((e) => `${e.sentido}|${e.dataLeitura.getTime()}`));

    const novas = lista.filter((l) => {
      const chave = `${l.sentido}|${l.dataLeitura.getTime()}`;
      if (chaves.has(chave)) return false;
      chaves.add(chave); // repetida dentro do proprio lote
      return true;
    });
    if (novas.length === 0) return 0;

    const { count } = await this.prisma.leitura.createMany({
      data: novas.map((l) => ({
        id: `ing-${randomUUID()}`,
        sala: estacao.nome,
        dataLeitura: l.dataLeitura,
        temperatura: l.valor,
        sentido: l.sentido,
        estacaoId: estacao.id,
        origem: estacao.origem,
      })),
    });
    return count;
  }
}
