// Tipos que espelham as respostas da API (backend NestJS).

export type Papel = 'ADMIN' | 'VISUALIZADOR';
export type Sentido = 'INTERNO' | 'EXTERNO';
// REAL = dado de sensor ou do USGS; SIMULADO = gerado pelo simulador (sempre marcado na tela)
export type Origem = 'REAL' | 'SIMULADO';

export interface Usuario {
  email: string;
  papel: Papel;
}

export interface RespostaLogin {
  token: string;
  usuario: Usuario;
}

export interface Sessao extends RespostaLogin {}

export interface PeriodoDisponivel {
  inicio: string | null;
  fim: string | null;
}

export interface ResumoSentido {
  sentido: Sentido;
  leituras: number;
  media: number;
  minima: number;
  maxima: number;
}

export interface Totais {
  totalLeituras: number;
  temperaturaMedia: number | null;
  salasMonitoradas: number;
  porSentido: ResumoSentido[];
}

export interface PontoSerie {
  hora: string;
  sentido: Sentido;
  temperaturaMedia: number;
}

export interface Leitura {
  id: string;
  sala: string;
  dataLeitura: string;
  temperatura: number;
  sentido: Sentido;
  origem: Origem;
}

export interface PaginaLeituras {
  total: number;
  pagina: number;
  limite: number;
  itens: Leitura[];
}

// Filtros comuns as consultas (datas no formato AAAA-MM-DD).
export interface Consulta {
  inicio: string;
  fim: string;
  sentido?: Sentido;
  estacaoId?: number;
  origem?: Origem;
}

export type FormatoRelatorio = 'pdf' | 'xlsx' | 'csv';

// Dados pessoais e de endereco editaveis (CPF, celular e CEP so com digitos).
export interface DadosPerfil {
  nome: string;
  cpf: string;
  celular: string;
  cep: string;
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  uf: string;
}

export interface Perfil {
  email: string;
  papel: Papel;
  criadoEm: string;
  nome: string | null;
  cpf: string | null;
  celular: string | null;
  cep: string | null;
  logradouro: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  cidade: string | null;
  uf: string | null;
  temAvatar: boolean;
  completo: boolean;
}

export interface ImagemAcervo {
  id: number;
  nomeOriginal: string;
  mime: string;
  tamanho: number;
  criadaEm: string;
}

// ---------- Estacoes e sismos ----------

export type TipoSensor = 'TEMPERATURA' | 'SISMOGRAFO' | 'GPS';
export type NivelAlerta = 'ATENCAO' | 'ALTO' | 'CRITICO';
export type EstadoAlerta = 'ABERTO' | 'RECONHECIDO' | 'ENCERRADO';

export interface Sensor {
  id: number;
  tipo: TipoSensor;
  nome: string;
  sentido: Sentido | null;
  ativo: boolean;
}

export interface Estacao {
  id: number;
  codigo: string;
  nome: string;
  latitude: number | null;
  longitude: number | null;
  placa: string | null;
  origem: Origem;
  ativa: boolean;
  monitoraComunicacao: boolean;
  temChave: boolean;
  ultimaLeitura: string | null;
  online: boolean;
  sensores: Sensor[];
}

export interface EventoSismico {
  id: number;
  idExterno: string;
  magnitude: number;
  profundidadeKm: number;
  latitude: number;
  longitude: number;
  local: string;
  ocorridoEm: string;
  origem: Origem;
  situacao: string;
  alertaId: number | null;
  alertaNivel: NivelAlerta | null;
  alertaEstado: EstadoAlerta | null;
  replicaDoAlertaId: number | null;
}

export interface PaginaEventos {
  total: number;
  pagina: number;
  limite: number;
  itens: EventoSismico[];
}

export interface PontoMapa {
  id: number;
  magnitude: number;
  profundidadeKm: number;
  latitude: number;
  longitude: number;
  local: string;
  ocorridoEm: string;
  origem: Origem;
}

export interface TotaisSismos {
  totalEventos: number;
  maiorMagnitude: number | null;
  porNivel: { REGISTRO: number; ATENCAO: number; ALTO: number; CRITICO: number };
  alertasAbertos: { ATENCAO: number; ALTO: number; CRITICO: number };
  estacoes: { ativas: number; online: number };
}

export interface DiaSismos {
  dia: string;
  eventos: number;
  maiorMagnitude: number;
}

export interface FiltrosSismos {
  inicio: string;
  fim: string;
  regiao?: string;
  magnitudeMin?: number;
  nivel?: NivelAlerta;
  origem?: Origem;
  estacaoId?: number;
}

export interface AlertaResumo {
  id: number;
  tipo: 'SISMO' | 'SEM_COMUNICACAO';
  nivel: NivelAlerta;
  nivelAnterior: NivelAlerta | null;
  estado: EstadoAlerta;
  titulo: string;
  abertoEm: string;
  encerradoEm: string | null;
  encerradoAutomatico: boolean;
  motivoEncerramento: string | null;
  evento: { magnitude: number; profundidadeKm: number; local: string; ocorridoEm: string; origem: Origem } | null;
  estacao: { id: number; nome: string; origem: Origem } | null;
  _count: { replicas: number };
}

export interface PaginaAlertas {
  total: number;
  pagina: number;
  limite: number;
  itens: AlertaResumo[];
}

export interface AlertaDetalhe extends Omit<AlertaResumo, '_count' | 'evento'> {
  reconhecidoEm: string | null;
  reconhecidoPorId: number | null;
  evento: (EventoSismico | null) & { latitude?: number; longitude?: number };
  replicas: { id: number; magnitude: number; local: string; ocorridoEm: string }[];
  historico: { id: number; acao: string; detalhes: string | null; usuarioId: number | null; criadoEm: string }[];
  estacoesProximas: { id: number; codigo: string; nome: string; origem: Origem; distanciaKm: number }[];
}

export interface SeriesEstacao {
  estacao: { id: number; nome: string; origem: Origem };
  horas: number;
  sismografo: { instante: string; amplitude: number }[];
  gps: { instante: string; deslocamentoLesteMm: number | null; deslocamentoNorteMm: number | null }[];
  temperatura: { instante: string; sentido: Sentido; temperatura: number }[];
}

// Regiao do mundo escolhivel no mapa (caixa geografica + texto sobre a geologia local)
export interface Regiao {
  codigo: string;
  nome: string;
  latMin: number;
  latMax: number;
  lonMin: number;
  lonMax: number;
  centro: [number, number];
  zoom: number;
  alerta: boolean;
  placas: string;
  contexto: string;
  eventos: number;
  maiorMagnitude: number | null;
}

export interface RespostaRegioes {
  total: number;
  regioes: Regiao[];
}
