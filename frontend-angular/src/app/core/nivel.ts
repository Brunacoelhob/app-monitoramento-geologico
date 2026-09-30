import { NivelAlerta } from './modelos';

// Mesmos limites do backend (RN-13). Abaixo de 4,5 e so "registro", sem alerta.
export function nivelDe(magnitude: number): NivelAlerta | 'REGISTRO' {
  if (magnitude >= 6.5) return 'CRITICO';
  if (magnitude >= 5.5) return 'ALTO';
  if (magnitude >= 4.5) return 'ATENCAO';
  return 'REGISTRO';
}

// RN-28: a API entrega UTC; o modulo de sismos mostra o horario do Japao (JST).
export const FUSO_JAPAO = '+0900';
const formatoJst = new Intl.DateTimeFormat('pt-BR', { timeZone: 'Asia/Tokyo', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
export const dataJst = (iso: string) => `${formatoJst.format(new Date(iso))} JST`;
