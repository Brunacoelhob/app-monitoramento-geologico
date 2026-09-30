import { Injectable } from '@nestjs/common';
import { Estacao, EventoSismico, Sensor } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { regras } from './config';
import { IngestaoService, LeituraEntrada } from './ingestao.service';
import { distanciaKm } from './regras';

// Velocidade aproximada de cada placa (mm por ano, leste e norte). Valores plausiveis
// para a simulacao; nao sao medidas oficiais.
const VELOCIDADE_PLACA: Record<string, { leste: number; norte: number }> = {
  PACIFICA: { leste: -75, norte: 30 },
  FILIPINAS: { leste: -35, norte: 35 },
  OKHOTSK: { leste: -22, norte: -8 },
  AMUR: { leste: -12, norte: -8 },
};
const ORIGEM_GPS = new Date('2026-01-01T00:00:00Z').getTime();
const MS_ANO = 365.25 * 86_400_000;

// Numero "normal" (media 0, desvio 1) pelo metodo de Box-Muller.
const gaussiano = () => Math.sqrt(-2 * Math.log(1 - Math.random())) * Math.cos(2 * Math.PI * Math.random());
const arredondar = (valor: number, casas: number) => Math.round(valor * 10 ** casas) / 10 ** casas;

// RN-08: gera leituras plausiveis de sismografo, GPS e temperatura para as estacoes
// SIMULADAS. Elas passam pelo mesmo caminho de um sensor real (IngestaoService).
@Injectable()
export class SimuladorService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ingestao: IngestaoService,
  ) {}

  // Um "tick" por minuto: gera a leitura do minuto atual de cada estacao simulada.
  async tick(agora = new Date()): Promise<void> {
    const minuto = new Date(Math.floor(agora.getTime() / 60_000) * 60_000);
    const eventos = await this.eventosRecentes(minuto);
    for (const estacao of await this.estacoesSimuladas()) {
      await this.ingestao.ingerir(estacao, this.gerarMinuto(estacao, estacao.sensores, minuto, eventos));
    }
  }

  // Preenche as ultimas N horas (max. 23, o limite de atraso aceito na ingestao - RN-11).
  async preencherHistorico(horas = 12): Promise<number> {
    const fim = Math.floor(Date.now() / 60_000) * 60_000;
    const inicio = fim - Math.min(horas, 23) * 3_600_000;
    const eventos = await this.prisma.eventoSismico.findMany({
      where: { situacao: { not: 'CANCELADO' }, magnitude: { gte: 5 }, ocorridoEm: { gte: new Date(inicio - 900_000) } },
    });

    let total = 0;
    for (const estacao of await this.estacoesSimuladas()) {
      let lote: LeituraEntrada[] = [];
      const enviar = async () => {
        if (lote.length === 0) return;
        total += (await this.ingestao.ingerir(estacao, lote)).aceitas;
        lote = [];
      };
      for (let t = inicio; t <= fim; t += 60_000) {
        lote.push(...this.gerarMinuto(estacao, estacao.sensores, new Date(t), eventos));
        if (lote.length >= 400) await enviar();
      }
      await enviar();
    }
    return total;
  }

  private estacoesSimuladas() {
    return this.prisma.estacao.findMany({
      where: { origem: 'SIMULADO', ativa: true },
      include: { sensores: { where: { ativo: true } } },
    });
  }

  // Sismos reais recentes que podem "balancar" as estacoes simuladas.
  private eventosRecentes(minuto: Date) {
    return this.prisma.eventoSismico.findMany({
      where: { situacao: { not: 'CANCELADO' }, magnitude: { gte: 5 }, ocorridoEm: { gte: new Date(minuto.getTime() - 900_000) } },
    });
  }

  private gerarMinuto(
    estacao: Estacao,
    sensores: Sensor[],
    instante: Date,
    eventos: EventoSismico[],
  ): LeituraEntrada[] {
    const minuto = instante.getUTCMinutes();
    const leituras: LeituraEntrada[] = [];
    for (const sensor of sensores) {
      if (sensor.tipo === 'SISMOGRAFO') {
        leituras.push({ sensorId: sensor.id, instante, amplitude: this.amplitude(estacao, instante, eventos) });
      } else if (sensor.tipo === 'GPS' && minuto % 5 === 0) {
        leituras.push({ sensorId: sensor.id, instante, ...this.posicaoGps(estacao, instante) });
      } else if (sensor.tipo === 'TEMPERATURA' && minuto % 10 === 0 && sensor.sentido) {
        leituras.push({ sensorId: sensor.id, instante, temperatura: this.temperatura(estacao, sensor.sentido, instante) });
      }
    }
    return leituras;
  }

  // Ruido de fundo + pico quando um sismo real (M >= 5) acontece perto da estacao.
  private amplitude(estacao: Estacao, instante: Date, eventos: EventoSismico[]): number {
    let amplitude = 0.02 + Math.abs(gaussiano()) * 0.03;
    if (estacao.latitude === null || estacao.longitude === null) return arredondar(amplitude, 3);

    const { distanciaProximaKm } = regras();
    for (const evento of eventos) {
      const distancia = distanciaKm(evento, { latitude: estacao.latitude, longitude: estacao.longitude });
      if (distancia > distanciaProximaKm) continue;
      // A onda leva ~ distancia / 3,5 km/s para chegar; depois o sinal decai com o tempo.
      const minutosDesdeChegada = (instante.getTime() - evento.ocorridoEm.getTime()) / 60_000 - distancia / 3.5 / 60;
      if (minutosDesdeChegada < 0 || minutosDesdeChegada > 15) continue;
      amplitude +=
        0.3 * 10 ** (0.6 * (evento.magnitude - 5)) * Math.exp(-distancia / 120) * Math.exp(-minutosDesdeChegada / 4);
    }
    return arredondar(amplitude, 3);
  }

  // Deslocamento acumulado desde 01/01/2026 na velocidade da placa da estacao (+ ruido de 1 mm).
  private posicaoGps(estacao: Estacao, instante: Date) {
    const v = VELOCIDADE_PLACA[estacao.placa ?? ''] ?? { leste: 0, norte: 0 };
    const anos = (instante.getTime() - ORIGEM_GPS) / MS_ANO;
    return {
      latitude: estacao.latitude ?? 0,
      longitude: estacao.longitude ?? 0,
      altitudeM: arredondar(40 + gaussiano() * 0.02, 3),
      deslocamentoLesteMm: arredondar(v.leste * anos + gaussiano(), 2),
      deslocamentoNorteMm: arredondar(v.norte * anos + gaussiano(), 2),
    };
  }

  // Clima aproximado do Japao: estacoes do ano, ciclo do dia (em JST) e mais frio ao norte.
  private temperatura(estacao: Estacao, sentido: 'INTERNO' | 'EXTERNO', instante: Date): number {
    const inicioAno = Date.UTC(instante.getUTCFullYear(), 0, 0);
    const diaDoAno = (instante.getTime() - inicioAno) / 86_400_000;
    const horaJst = (instante.getUTCHours() + 9 + instante.getUTCMinutes() / 60) % 24;
    const ajusteLatitude = -((estacao.latitude ?? 35) - 35) * 0.6;

    const externa =
      16 + ajusteLatitude - 11 * Math.cos((2 * Math.PI * (diaDoAno - 20)) / 365) +
      4 * Math.sin((2 * Math.PI * (horaJst - 9)) / 24) + gaussiano() * 0.5;
    if (sentido === 'EXTERNO') return arredondar(externa, 1);
    // Dentro de casa a temperatura oscila menos e segue a de fora de longe.
    return arredondar(22 + 0.15 * (externa - 22) + gaussiano() * 0.3, 1);
  }
}
