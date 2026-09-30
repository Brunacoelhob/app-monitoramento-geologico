// Parametros do modulo de sismos. Os valores iniciais sao os da tabela do
// documento de regras (docs/regras-de-negocio-sismos.md) e podem ser trocados no .env.

const numero = (nome: string, padrao: number): number => {
  const bruto = process.env[nome];
  const valor = bruto === undefined || bruto === '' ? NaN : Number(bruto);
  return Number.isFinite(valor) ? valor : padrao;
};

// Lido a cada chamada (e nao uma vez so) para os testes poderem trocar o ambiente.
export const regras = () => ({
  // RN-07: sismos do USGS
  magnitudeMinimaImportada: numero('SISMOS_MAGNITUDE_MINIMA', 4.0), // Japao
  magnitudeMinimaMundo: numero('SISMOS_MAGNITUDE_MINIMA_MUNDO', 4.5), // resto do mundo
  intervaloUsgsMinutos: numero('SISMOS_INTERVALO_USGS_MIN', 10),
  diasCargaInicial: numero('SISMOS_DIAS_CARGA_INICIAL', 30),
  // RN-15: estacao proxima
  distanciaProximaKm: numero('SISMOS_DISTANCIA_PROXIMA_KM', 300),
  // RN-21: replicas
  replicaKm: numero('SISMOS_REPLICA_KM', 50),
  replicaHoras: numero('SISMOS_REPLICA_HORAS', 24),
  // RN-20
  encerramentoAtencaoHoras: numero('SISMOS_ENCERRAMENTO_ATENCAO_HORAS', 72),
  // RN-22 e RN-24
  semComunicacaoMinutos: numero('SISMOS_SEM_COMUNICACAO_MIN', 15),
  // RN-10 e RN-11
  atrasoMaximoHoras: numero('SISMOS_ATRASO_MAXIMO_HORAS', 24),
  toleranciaFuturoMinutos: 5,
  // RN-29
  retencaoSismografoDias: numero('SISMOS_RETENCAO_SISMOGRAFO_DIAS', 30),
  // Liga/desliga as tarefas em segundo plano (USGS, simulador, manutencao)
  agendador: (process.env.SISMOS_AGENDADOR ?? 'true') !== 'false',
});

// RN-07: caixa geografica do Japao
export const CAIXA_JAPAO = { latMin: 24, latMax: 46, lonMin: 122, lonMax: 146 };

// RN-13: limites fixos de magnitude (nao configuraveis de proposito)
export const LIMITE_ATENCAO = 4.5;
export const LIMITE_ALTO = 5.5;
export const LIMITE_CRITICO = 6.5;
