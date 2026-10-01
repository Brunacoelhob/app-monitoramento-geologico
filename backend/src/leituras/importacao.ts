// Leitura e validacao do CSV de importacao de temperaturas (funcoes puras, sem banco).
// Aceita tanto o formato do dataset original (id, room_id/id, noted_date, temp, out/in)
// quanto colunas em portugues (sala, data_leitura, temperatura, sentido, id opcional).

import { Sentido } from '@prisma/client';
import { parse } from 'csv-parse/sync';
import { converterData } from './tratamento';

export const MAX_LINHAS_IMPORTACAO = 20_000;

export interface LeituraImportada {
  linha: number; // numero da linha no arquivo (o cabecalho e a linha 1)
  id?: string;
  sala: string;
  dataLeitura: Date;
  temperatura: number;
  sentido: Sentido;
}

export interface ErroLinha {
  linha: number;
  motivo: string;
}

export interface ResultadoLeituraCsv {
  totalLinhas: number;
  validas: LeituraImportada[];
  erros: ErroLinha[];
  repetidasNoArquivo: number;
}

export class CsvInvalidoError extends Error {}

// Nomes aceitos para cada coluna (comparados sem acento, sem maiusculas e sem espacos nas pontas)
const COLUNAS: Record<'id' | 'sala' | 'data' | 'temperatura' | 'sentido', string[]> = {
  id: ['id'],
  sala: ['sala', 'room_id/id', 'room', 'ambiente'],
  data: ['data_leitura', 'data', 'noted_date', 'data_hora', 'datahora'],
  temperatura: ['temperatura', 'temp', 'temperature'],
  sentido: ['sentido', 'out/in', 'direcao'],
};

const SENTIDOS: Record<string, Sentido> = {
  interno: Sentido.INTERNO,
  in: Sentido.INTERNO,
  dentro: Sentido.INTERNO,
  externo: Sentido.EXTERNO,
  out: Sentido.EXTERNO,
  fora: Sentido.EXTERNO,
};

const normalizar = (texto: string) =>
  texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toLowerCase();

function detectarSeparador(texto: string): string {
  const primeira = texto.split(/\r?\n/, 1)[0] ?? '';
  return (primeira.match(/;/g)?.length ?? 0) >= (primeira.match(/,/g)?.length ?? 0) && primeira.includes(';') ? ';' : ',';
}

// Aceita dd-mm-aaaa hh:mm (original), dd/mm/aaaa hh:mm[:ss] e ISO 8601. Sem fuso, vale UTC (como no resto do sistema).
export function lerData(texto: string): Date {
  const t = texto.trim();
  const br = /^(\d{2})\/(\d{2})\/(\d{4})(?: (\d{2}):(\d{2})(?::(\d{2}))?)?$/.exec(t);
  if (br) {
    const [, d, m, a, h = '0', mi = '0', s = '0'] = br;
    const data = new Date(Date.UTC(+a, +m - 1, +d, +h, +mi, +s));
    if (data.getUTCDate() !== +d || data.getUTCMonth() !== +m - 1) throw new Error(`Data inexistente: '${t}'.`);
    return data;
  }
  if (/^\d{2}-\d{2}-\d{4} \d{2}:\d{2}$/.test(t)) return converterData(t);

  const iso = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?(Z|[+-]\d{2}:?\d{2})?$/.exec(t);
  if (iso) {
    const [, a, m, d, h = '00', mi = '00', s = '00', fuso = 'Z'] = iso;
    const fusoNormalizado = fuso === 'Z' ? 'Z' : fuso.length === 5 ? `${fuso.slice(0, 3)}:${fuso.slice(3)}` : fuso;
    const data = new Date(`${a}-${m}-${d}T${h}:${mi}:${s}${fusoNormalizado}`);
    if (!Number.isNaN(data.getTime()) && data.getUTCDate() === +d) return data;
  }
  throw new Error(`Data invalida: '${t}'. Use dd/mm/aaaa hh:mm, dd-mm-aaaa hh:mm ou AAAA-MM-DD hh:mm.`);
}

function lerTemperatura(texto: string): number {
  const valor = Number(texto.trim().replace(',', '.'));
  if (texto.trim() === '' || !Number.isFinite(valor)) throw new Error(`Temperatura invalida: '${texto.trim()}'.`);
  if (valor < -50 || valor > 150) throw new Error(`Temperatura fora da faixa de -50 a 150 °C: ${valor}.`);
  return Math.round(valor * 10) / 10; // o banco guarda 1 casa decimal
}

export function lerCsvLeituras(conteudo: string, agora = new Date()): ResultadoLeituraCsv {
  const texto = conteudo.replace(/^﻿/, '');
  if (!texto.trim()) throw new CsvInvalidoError('O arquivo está vazio.');

  let registros: string[][];
  try {
    registros = parse(texto, { delimiter: detectarSeparador(texto), skip_empty_lines: true, relax_column_count: true, trim: true });
  } catch (erro) {
    throw new CsvInvalidoError(`Não foi possível ler o CSV: ${(erro as Error).message}`);
  }

  const [cabecalho, ...dados] = registros;
  const nomes = cabecalho.map(normalizar);
  const indice = (chave: keyof typeof COLUNAS) => nomes.findIndex((n) => COLUNAS[chave].includes(n));
  const posicao = { id: indice('id'), sala: indice('sala'), data: indice('data'), temperatura: indice('temperatura'), sentido: indice('sentido') };

  const faltam = (['sala', 'data', 'temperatura', 'sentido'] as const).filter((c) => posicao[c] === -1);
  if (faltam.length > 0) {
    const rotulos = { sala: 'sala', data: 'data_leitura', temperatura: 'temperatura', sentido: 'sentido' };
    throw new CsvInvalidoError(
      `Cabeçalho inválido: faltam as colunas ${faltam.map((c) => rotulos[c]).join(', ')}. Baixe o modelo para ver o formato esperado.`,
    );
  }
  if (dados.length === 0) throw new CsvInvalidoError('O arquivo tem só o cabeçalho, sem nenhuma leitura.');
  if (dados.length > MAX_LINHAS_IMPORTACAO) {
    throw new CsvInvalidoError(`O arquivo tem ${dados.length} linhas e o máximo por importação é ${MAX_LINHAS_IMPORTACAO}. Divida em arquivos menores.`);
  }

  const validas: LeituraImportada[] = [];
  const erros: ErroLinha[] = [];
  const idsVistos = new Set<string>();
  let repetidasNoArquivo = 0;
  const limiteFuturo = agora.getTime() + 5 * 60_000; // mesma tolerancia da ingestao (RN-10)

  dados.forEach((celulas, i) => {
    const linha = i + 2;
    try {
      const sala = (celulas[posicao.sala] ?? '').trim();
      if (!sala) throw new Error('Sala em branco.');
      if (sala.length > 100) throw new Error('Sala com mais de 100 caracteres.');

      const sentido = SENTIDOS[normalizar(celulas[posicao.sentido] ?? '')];
      if (!sentido) throw new Error(`Sentido invalido: '${celulas[posicao.sentido] ?? ''}'. Use INTERNO ou EXTERNO (ou In/Out).`);

      const dataLeitura = lerData(celulas[posicao.data] ?? '');
      if (dataLeitura.getTime() > limiteFuturo) throw new Error('A data está no futuro.');

      const temperatura = lerTemperatura(celulas[posicao.temperatura] ?? '');

      const id = posicao.id === -1 ? '' : (celulas[posicao.id] ?? '').trim();
      if (id.length > 100) throw new Error('Id com mais de 100 caracteres.');
      if (id) {
        if (idsVistos.has(id)) {
          repetidasNoArquivo++;
          return;
        }
        idsVistos.add(id);
      }

      validas.push({ linha, id: id || undefined, sala, dataLeitura, temperatura, sentido });
    } catch (erro) {
      erros.push({ linha, motivo: (erro as Error).message });
    }
  });

  return { totalLinhas: dados.length, validas, erros, repetidasNoArquivo };
}

export const MODELO_CSV =
  'sala;data_leitura;temperatura;sentido;id\n' +
  'Sala de servidores;29/09/2026 14:30;22,4;INTERNO;\n' +
  'Sala de servidores;29/09/2026 14:30;27,1;EXTERNO;\n' +
  'Almoxarifado;29/09/2026 14:35;19,8;INTERNO;leitura-0003\n';
