import { NivelAlerta, TipoSensor } from '@prisma/client';
import { LIMITE_ALTO, LIMITE_ATENCAO, LIMITE_CRITICO } from './config';

// Regras de negocio "puras" (sem banco): ficam aqui para serem testadas sozinhas.

export interface Ponto {
  latitude: number;
  longitude: number;
}

export interface EventoParaRegra extends Ponto {
  magnitude: number;
  ocorridoEm: Date;
}

// RN-13: nivel pela magnitude. Abaixo de 4,5 e so registro (sem alerta).
export function nivelPorMagnitude(magnitude: number): NivelAlerta | null {
  if (magnitude >= LIMITE_CRITICO) return 'CRITICO';
  if (magnitude >= LIMITE_ALTO) return 'ALTO';
  if (magnitude >= LIMITE_ATENCAO) return 'ATENCAO';
  return null;
}

// Distancia pela superficie da Terra (formula de haversine), em km.
export function distanciaKm(a: Ponto, b: Ponto): number {
  const raioTerraKm = 6371;
  const rad = (graus: number) => (graus * Math.PI) / 180;
  const dLat = rad(b.latitude - a.latitude);
  const dLon = rad(b.longitude - a.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return 2 * raioTerraKm * Math.asin(Math.min(1, Math.sqrt(h)));
}

// RN-21: o evento e replica do principal quando acontece DEPOIS dele, em ate
// `replicaHoras`, a ate `replicaKm` de distancia, e com magnitude menor ou igual.
export function ehReplica(
  evento: EventoParaRegra,
  principal: EventoParaRegra,
  limites: { replicaKm: number; replicaHoras: number },
): boolean {
  const horasDepois = (evento.ocorridoEm.getTime() - principal.ocorridoEm.getTime()) / 3_600_000;
  return (
    evento.magnitude <= principal.magnitude &&
    horasDepois >= 0 &&
    horasDepois <= limites.replicaHoras &&
    distanciaKm(evento, principal) <= limites.replicaKm
  );
}

// RN-20: so o nivel Atencao se encerra sozinho, depois de N horas abertas.
export function deveEncerrarAtencao(
  alerta: { nivel: NivelAlerta; abertoEm: Date },
  agora: Date,
  horas: number,
): boolean {
  return alerta.nivel === 'ATENCAO' && agora.getTime() - alerta.abertoEm.getTime() > horas * 3_600_000;
}

// RN-22 e RN-24: "online" = teve leitura nos ultimos N minutos.
export function estaOnline(ultimaLeitura: Date | null, agora: Date, minutos: number): boolean {
  return ultimaLeitura !== null && agora.getTime() - ultimaLeitura.getTime() <= minutos * 60_000;
}

export interface LeituraEntrada {
  instante: Date;
  temperatura?: number;
  amplitude?: number;
  latitude?: number;
  longitude?: number;
  altitudeM?: number;
}

const finito = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

// RN-10 e RN-11: devolve o motivo da recusa, ou null se a leitura e valida.
export function validarLeitura(
  tipo: TipoSensor,
  leitura: LeituraEntrada,
  agora: Date,
  limites: { atrasoMaximoHoras: number; toleranciaFuturoMinutos: number },
): string | null {
  if (Number.isNaN(leitura.instante.getTime())) return 'Horário inválido.';

  const diferenca = agora.getTime() - leitura.instante.getTime();
  if (diferenca < -limites.toleranciaFuturoMinutos * 60_000) return 'Horário no futuro.';
  if (diferenca > limites.atrasoMaximoHoras * 3_600_000) {
    return `Leitura atrasada: passou de ${limites.atrasoMaximoHoras} horas.`;
  }

  switch (tipo) {
    case 'TEMPERATURA':
      if (!finito(leitura.temperatura)) return 'Informe a temperatura.';
      if (leitura.temperatura < -60 || leitura.temperatura > 80) return 'Temperatura fora da faixa (-60 a 80 °C).';
      return null;
    case 'SISMOGRAFO':
      if (!finito(leitura.amplitude)) return 'Informe a amplitude.';
      if (leitura.amplitude < 0 || leitura.amplitude > 1_000_000) return 'Amplitude fora da faixa.';
      return null;
    case 'GPS':
      if (!finito(leitura.latitude) || leitura.latitude < -90 || leitura.latitude > 90) return 'Latitude inválida.';
      if (!finito(leitura.longitude) || leitura.longitude < -180 || leitura.longitude > 180) return 'Longitude inválida.';
      if (leitura.altitudeM !== undefined && !finito(leitura.altitudeM)) return 'Altitude inválida.';
      return null;
  }
}
