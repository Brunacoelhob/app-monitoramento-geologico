// Tratamento e validacao das leituras (funcoes puras, sem banco, faceis de testar).

import { Sentido } from '@prisma/client';

export interface LeituraTratada {
  id: string;
  sala: string;
  dataLeitura: Date;
  temperatura: number;
  sentido: Sentido;
}

const SENTIDOS: Record<string, Sentido> = { in: Sentido.INTERNO, out: Sentido.EXTERNO };

// Converte "dd-mm-aaaa hh:mm" para Date em UTC (o banco guarda sem fuso).
export function converterData(texto: string): Date {
  const partes = /^(\d{2})-(\d{2})-(\d{4}) (\d{2}):(\d{2})$/.exec(texto.trim());
  if (!partes) throw new Error(`Data invalida: '${texto}' (esperado dd-mm-aaaa hh:mm).`);

  const [, dia, mes, ano, hora, minuto] = partes.map(Number);
  const data = new Date(Date.UTC(ano, mes - 1, dia, hora, minuto));

  // Rejeita datas que o JS "corrige" sozinho (ex.: 31-02).
  if (data.getUTCDate() !== dia || data.getUTCMonth() !== mes - 1) {
    throw new Error(`Data inexistente: '${texto}'.`);
  }
  return data;
}

// Valida e converte uma linha do CSV original.
export function tratarLinha(linha: Record<string, string>): LeituraTratada {
  const id = (linha['id'] ?? '').trim();
  const sala = (linha['room_id/id'] ?? '').trim();
  if (!id || !sala) throw new Error('Linha sem id ou sala.');

  const sentido = SENTIDOS[(linha['out/in'] ?? '').trim().toLowerCase()];
  if (!sentido) throw new Error(`Sentido invalido: '${linha['out/in']}' (esperado In ou Out).`);

  const temperatura = Number(linha['temp']);
  if (!Number.isFinite(temperatura)) throw new Error(`Temperatura invalida: '${linha['temp']}'.`);

  return { id, sala, dataLeitura: converterData(linha['noted_date'] ?? ''), temperatura, sentido };
}

// Regra de duplicidade: so o mesmo id conta como repetido.
// Leituras iguais com ids diferentes sao mantidas (podem ser legitimas).
export function removerIdsRepetidos(leituras: LeituraTratada[]): LeituraTratada[] {
  const vistos = new Set<string>();
  return leituras.filter((leitura) => {
    if (vistos.has(leitura.id)) return false;
    vistos.add(leitura.id);
    return true;
  });
}
