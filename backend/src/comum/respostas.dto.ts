import { ApiProperty } from '@nestjs/swagger';
import { EstadoAlerta, NivelAlerta, Origem, Papel, Sentido, SituacaoEvento, TipoAlerta, TipoSensor } from '@prisma/client';

// Modelos das RESPOSTAS da API, usados so na documentacao (Swagger). Os exemplos usam dados plausiveis
// (Japao / estacao de Sendai) e nunca dados reais de pessoas.

const ISO = '2026-09-29T19:45:13.000Z';

export class ErroApi {
  @ApiProperty({ example: 400, description: 'Código de status HTTP.' })
  statusCode: number;

  @ApiProperty({
    oneOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' } }],
    example: ['inicio deve ser uma data válida (AAAA-MM-DD)'],
    description: 'Mensagem explicando o erro. Em validação, vem uma lista com um item por campo.',
  })
  message: string | string[];

  @ApiProperty({ example: 'Bad Request', description: 'Nome do status HTTP.' })
  error: string;
}

// ---------- Autenticacao ----------

export class UsuarioResumoResposta {
  @ApiProperty({ example: 'admin@iot.local' }) email: string;
  @ApiProperty({ enum: Papel, enumName: 'Papel', example: Papel.ADMIN, description: 'ADMIN também gerencia; VISUALIZADOR só consulta.' })
  papel: Papel;
}

export class LoginResposta {
  @ApiProperty({ example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOjEsImVtYWlsIjoiYWRtaW5AaW90LmxvY2FsIn0.assinatura', description: 'JWT para o cadeado Authorize.' })
  token: string;
  @ApiProperty({ type: UsuarioResumoResposta }) usuario: UsuarioResumoResposta;
}

export class UsuarioAutenticadoResposta {
  @ApiProperty({ example: 1 }) id: number;
  @ApiProperty({ example: 'admin@iot.local' }) email: string;
  @ApiProperty({ enum: Papel, enumName: 'Papel', example: Papel.ADMIN }) papel: Papel;
}

export class PeriodoResposta {
  @ApiProperty({ nullable: true, type: String, example: '2026-01-05T10:00:00.000Z', description: 'Primeira data com dados (null se não há dados).' })
  inicio: string | null;
  @ApiProperty({ nullable: true, type: String, example: ISO, description: 'Última data com dados (null se não há dados).' })
  fim: string | null;
}

// ---------- Temperatura ----------

export class LeituraResposta {
  @ApiProperty({ example: 'ing-3f6b1c2e-9d84-4a6f-8d1b-0a2d7c5e9f10' }) id: string;
  @ApiProperty({ example: 'Sala de servidores' }) sala: string;
  @ApiProperty({ example: ISO }) dataLeitura: string;
  @ApiProperty({ example: 22.4, description: 'Temperatura em °C (1 casa decimal).' }) temperatura: number;
  @ApiProperty({ enum: Sentido, enumName: 'Sentido', example: Sentido.INTERNO }) sentido: Sentido;
  @ApiProperty({ enum: Origem, enumName: 'Origem', example: Origem.REAL }) origem: Origem;
}

export class PaginaLeiturasResposta {
  @ApiProperty({ example: 1240, description: 'Total de leituras que atendem aos filtros.' }) total: number;
  @ApiProperty({ example: 1 }) pagina: number;
  @ApiProperty({ example: 50 }) limite: number;
  @ApiProperty({ type: [LeituraResposta] }) itens: LeituraResposta[];
}

export class ResumoSentidoResposta {
  @ApiProperty({ enum: Sentido, enumName: 'Sentido', example: Sentido.INTERNO }) sentido: Sentido;
  @ApiProperty({ example: 620 }) leituras: number;
  @ApiProperty({ example: 22.1 }) media: number;
  @ApiProperty({ example: 18.4 }) minima: number;
  @ApiProperty({ example: 26.9 }) maxima: number;
}

export class TotaisLeiturasResposta {
  @ApiProperty({ example: 1240 }) totalLeituras: number;
  @ApiProperty({ nullable: true, type: Number, example: 21.7, description: 'Média geral em °C (null sem leituras).' }) temperaturaMedia: number | null;
  @ApiProperty({ example: 3, description: 'Quantidade de salas/estações distintas no período.' }) salasMonitoradas: number;
  @ApiProperty({ type: [ResumoSentidoResposta] }) porSentido: ResumoSentidoResposta[];
}

export class PontoSerieHorariaResposta {
  @ApiProperty({ example: '2026-09-29T19:00:00.000Z', description: 'Início da hora (UTC).' }) hora: string;
  @ApiProperty({ enum: Sentido, enumName: 'Sentido', example: Sentido.EXTERNO }) sentido: Sentido;
  @ApiProperty({ example: 27.3, description: 'Média das leituras dessa hora em °C.' }) temperaturaMedia: number;
}

// ---------- Estacoes ----------

export class SensorResposta {
  @ApiProperty({ example: 12 }) id: number;
  @ApiProperty({ enum: TipoSensor, enumName: 'TipoSensor', example: TipoSensor.SISMOGRAFO }) tipo: TipoSensor;
  @ApiProperty({ example: 'Sismógrafo vertical' }) nome: string;
  @ApiProperty({ enum: Sentido, enumName: 'Sentido', nullable: true, example: null, description: 'Só existe para sensores de TEMPERATURA.' })
  sentido: Sentido | null;
  @ApiProperty({ example: true }) ativo: boolean;
}

export class EstacaoResposta {
  @ApiProperty({ example: 4 }) id: number;
  @ApiProperty({ example: 'JP-SENDAI' }) codigo: string;
  @ApiProperty({ example: 'Sendai' }) nome: string;
  @ApiProperty({ nullable: true, type: Number, example: 38.2682 }) latitude: number | null;
  @ApiProperty({ nullable: true, type: Number, example: 140.8694 }) longitude: number | null;
  @ApiProperty({ nullable: true, type: String, example: 'PACIFICA', description: 'Placa tectônica: PACIFICA, FILIPINAS, OKHOTSK ou AMUR.' }) placa: string | null;
  @ApiProperty({ enum: Origem, enumName: 'Origem', example: Origem.SIMULADO }) origem: Origem;
  @ApiProperty({ example: true, description: 'Estação inativa não recebe leituras (o histórico continua).' }) ativa: boolean;
  @ApiProperty({ example: true, description: 'Se true, a falta de leituras gera alerta de "sem comunicação".' }) monitoraComunicacao: boolean;
  @ApiProperty({ example: true, description: 'Se já existe chave de API (a chave em si nunca é devolvida depois de criada).' }) temChave: boolean;
  @ApiProperty({ nullable: true, type: String, example: ISO, description: 'Instante da última leitura de qualquer sensor.' }) ultimaLeitura: string | null;
  @ApiProperty({ example: true, description: 'Enviou leitura dentro da janela de comunicação configurada.' }) online: boolean;
  @ApiProperty({ type: [SensorResposta] }) sensores: SensorResposta[];
}

export class EstacaoCriadaResposta extends EstacaoResposta {
  @ApiProperty({ example: 'est_9c1f0a7d4e2b58a36f1d0c9b7e4a2f8d61b3c5e7a9d0f214', description: 'Chave de API em texto puro. É mostrada SOMENTE agora: guarde-a.' })
  chave: string;
}

export class NovaChaveResposta {
  @ApiProperty({ example: 'est_9c1f0a7d4e2b58a36f1d0c9b7e4a2f8d61b3c5e7a9d0f214', description: 'Nova chave. A anterior deixa de valer imediatamente.' })
  chave: string;
}

class EstacaoResumoSerie {
  @ApiProperty({ example: 4 }) id: number;
  @ApiProperty({ example: 'Sendai' }) nome: string;
  @ApiProperty({ enum: Origem, enumName: 'Origem', example: Origem.SIMULADO }) origem: Origem;
}
class PontoSismografo {
  @ApiProperty({ example: ISO }) instante: string;
  @ApiProperty({ example: 0.42, description: 'Amplitude do sinal.' }) amplitude: number;
}
class PontoGps {
  @ApiProperty({ example: ISO }) instante: string;
  @ApiProperty({ nullable: true, type: Number, example: 1.8, description: 'Deslocamento para leste em mm.' }) deslocamentoLesteMm: number | null;
  @ApiProperty({ nullable: true, type: Number, example: -0.6, description: 'Deslocamento para norte em mm.' }) deslocamentoNorteMm: number | null;
}
class PontoTemperaturaEstacao {
  @ApiProperty({ example: ISO }) instante: string;
  @ApiProperty({ enum: Sentido, enumName: 'Sentido', example: Sentido.INTERNO }) sentido: Sentido;
  @ApiProperty({ example: 22.4 }) temperatura: number;
}

export class SeriesEstacaoResposta {
  @ApiProperty({ type: EstacaoResumoSerie }) estacao: EstacaoResumoSerie;
  @ApiProperty({ example: 24, description: 'Janela pedida, em horas.' }) horas: number;
  @ApiProperty({ type: [PontoSismografo] }) sismografo: PontoSismografo[];
  @ApiProperty({ type: [PontoGps] }) gps: PontoGps[];
  @ApiProperty({ type: [PontoTemperaturaEstacao] }) temperatura: PontoTemperaturaEstacao[];
}

// ---------- Ingestao ----------

class LeituraRejeitada {
  @ApiProperty({ example: 2, description: 'Posição (começando em 0) da leitura rejeitada no array enviado.' }) indice: number;
  @ApiProperty({ example: 'Este sensor não pertence à estação.' }) motivo: string;
}

export class ResultadoIngestaoResposta {
  @ApiProperty({ example: 18, description: 'Leituras gravadas.' }) aceitas: number;
  @ApiProperty({ example: 1, description: 'Leituras repetidas (mesmo sensor e mesmo instante), não gravadas de novo.' }) ignoradas: number;
  @ApiProperty({ type: [LeituraRejeitada], description: 'Leituras recusadas pelas regras de validação, com o motivo.' }) rejeitadas: LeituraRejeitada[];
}

// ---------- Sismos ----------

export class EventoResposta {
  @ApiProperty({ example: 1812 }) id: number;
  @ApiProperty({ example: 'us7000abcd', description: 'Identificador do evento no USGS.' }) idExterno: string;
  @ApiProperty({ example: 5.4, description: 'Magnitude.' }) magnitude: number;
  @ApiProperty({ example: 38.2 }) profundidadeKm: number;
  @ApiProperty({ example: 38.32 }) latitude: number;
  @ApiProperty({ example: 142.37 }) longitude: number;
  @ApiProperty({ example: '48 km E of Ishinomaki, Japan' }) local: string;
  @ApiProperty({ example: ISO }) ocorridoEm: string;
  @ApiProperty({ enum: Origem, enumName: 'Origem', example: Origem.REAL }) origem: Origem;
  @ApiProperty({ enum: SituacaoEvento, enumName: 'SituacaoEvento', example: SituacaoEvento.AUTOMATICO, description: 'AUTOMATICO (recém-importado), REVISADO ou CANCELADO. Cancelados ficam de fora por padrão.' })
  situacao: SituacaoEvento;
  @ApiProperty({ nullable: true, type: Number, example: 37, description: 'Alerta gerado por este sismo, se houver.' }) alertaId: number | null;
  @ApiProperty({ enum: NivelAlerta, enumName: 'NivelAlerta', nullable: true, example: NivelAlerta.ATENCAO }) alertaNivel: NivelAlerta | null;
  @ApiProperty({ enum: EstadoAlerta, enumName: 'EstadoAlerta', nullable: true, example: EstadoAlerta.ABERTO }) alertaEstado: EstadoAlerta | null;
  @ApiProperty({ nullable: true, type: Number, example: null, description: 'Se é réplica, o id do alerta do sismo principal.' }) replicaDoAlertaId: number | null;
}

export class PaginaEventosResposta {
  @ApiProperty({ example: 545 }) total: number;
  @ApiProperty({ example: 1 }) pagina: number;
  @ApiProperty({ example: 50 }) limite: number;
  @ApiProperty({ type: [EventoResposta] }) itens: EventoResposta[];
}

export class PontoMapaResposta {
  @ApiProperty({ example: 1812 }) id: number;
  @ApiProperty({ example: 5.4 }) magnitude: number;
  @ApiProperty({ example: 38.2 }) profundidadeKm: number;
  @ApiProperty({ example: 38.32 }) latitude: number;
  @ApiProperty({ example: 142.37 }) longitude: number;
  @ApiProperty({ example: '48 km E of Ishinomaki, Japan' }) local: string;
  @ApiProperty({ example: ISO }) ocorridoEm: string;
  @ApiProperty({ enum: Origem, enumName: 'Origem', example: Origem.REAL }) origem: Origem;
}

class PorNivel {
  @ApiProperty({ example: 480, description: 'Menor que M4,5.' }) REGISTRO: number;
  @ApiProperty({ example: 52, description: 'M4,5 a 5,4.' }) ATENCAO: number;
  @ApiProperty({ example: 12, description: 'M5,5 a 6,4.' }) ALTO: number;
  @ApiProperty({ example: 1, description: 'M6,5 ou mais.' }) CRITICO: number;
}
class AlertasAbertosPorNivel {
  @ApiProperty({ example: 1 }) ATENCAO: number;
  @ApiProperty({ example: 0 }) ALTO: number;
  @ApiProperty({ example: 0 }) CRITICO: number;
}
class ResumoEstacoes {
  @ApiProperty({ example: 4 }) ativas: number;
  @ApiProperty({ example: 4 }) online: number;
}

export class TotaisSismosResposta {
  @ApiProperty({ example: 545 }) totalEventos: number;
  @ApiProperty({ nullable: true, type: Number, example: 6.6 }) maiorMagnitude: number | null;
  @ApiProperty({ type: PorNivel }) porNivel: PorNivel;
  @ApiProperty({ type: AlertasAbertosPorNivel }) alertasAbertos: AlertasAbertosPorNivel;
  @ApiProperty({ type: ResumoEstacoes }) estacoes: ResumoEstacoes;
}

export class DiaSismosResposta {
  @ApiProperty({ example: '2026-09-29', description: 'Dia (AAAA-MM-DD).' }) dia: string;
  @ApiProperty({ example: 14 }) eventos: number;
  @ApiProperty({ example: 5.4 }) maiorMagnitude: number;
}

export class RegiaoResposta {
  @ApiProperty({ example: 'JAPAO' }) codigo: string;
  @ApiProperty({ example: 'Japão' }) nome: string;
  @ApiProperty({ example: 30 }) latMin: number;
  @ApiProperty({ example: 46 }) latMax: number;
  @ApiProperty({ example: 128 }) lonMin: number;
  @ApiProperty({ example: 148 }) lonMax: number;
  @ApiProperty({ type: [Number], example: [37, 138], description: '[latitude, longitude] do centro do mapa.' }) centro: number[];
  @ApiProperty({ example: 5 }) zoom: number;
  @ApiProperty({ example: true, description: 'Só regiões com alerta=true geram alertas de sismo.' }) alerta: boolean;
  @ApiProperty({ example: 'Pacífica, Filipinas, Okhotsk e Amur' }) placas: string;
  @ApiProperty({ example: 'Um dos arcos mais ativos do planeta...' }) contexto: string;
  @ApiProperty({ example: 210, description: 'Sismos da região no período filtrado.' }) eventos: number;
  @ApiProperty({ nullable: true, type: Number, example: 6.6 }) maiorMagnitude: number | null;
}

export class RegioesResposta {
  @ApiProperty({ example: 12 }) total: number;
  @ApiProperty({ type: [RegiaoResposta] }) regioes: RegiaoResposta[];
}

export class SincronizacaoResposta {
  @ApiProperty({ example: 312, description: 'Eventos recebidos do USGS.' }) recebidos: number;
  @ApiProperty({ example: 5, description: 'Eventos que ainda não existiam.' }) novos: number;
  @ApiProperty({ example: 2, description: 'Eventos já existentes que foram atualizados (ex.: magnitude revisada).' }) atualizados: number;
}

// ---------- Alertas ----------

class EventoDoAlerta {
  @ApiProperty({ example: 5.4 }) magnitude: number;
  @ApiProperty({ example: 38.2 }) profundidadeKm: number;
  @ApiProperty({ example: '48 km E of Ishinomaki, Japan' }) local: string;
  @ApiProperty({ example: ISO }) ocorridoEm: string;
  @ApiProperty({ enum: Origem, enumName: 'Origem', example: Origem.REAL }) origem: Origem;
}
class EstacaoDoAlerta {
  @ApiProperty({ example: 4 }) id: number;
  @ApiProperty({ example: 'Sendai' }) nome: string;
  @ApiProperty({ enum: Origem, enumName: 'Origem', example: Origem.SIMULADO }) origem: Origem;
}
class ContagemReplicas {
  @ApiProperty({ example: 3, description: 'Quantidade de réplicas ligadas a este alerta.' }) replicas: number;
}

export class AlertaResumoResposta {
  @ApiProperty({ example: 37 }) id: number;
  @ApiProperty({ enum: TipoAlerta, enumName: 'TipoAlerta', example: TipoAlerta.SISMO }) tipo: TipoAlerta;
  @ApiProperty({ enum: NivelAlerta, enumName: 'NivelAlerta', example: NivelAlerta.ATENCAO }) nivel: NivelAlerta;
  @ApiProperty({ enum: NivelAlerta, enumName: 'NivelAlerta', nullable: true, example: null, description: 'Nível antes de uma escalada.' }) nivelAnterior: NivelAlerta | null;
  @ApiProperty({ enum: EstadoAlerta, enumName: 'EstadoAlerta', example: EstadoAlerta.ABERTO }) estado: EstadoAlerta;
  @ApiProperty({ example: 'M5,4 - 48 km E of Ishinomaki, Japan' }) titulo: string;
  @ApiProperty({ example: ISO }) abertoEm: string;
  @ApiProperty({ nullable: true, type: String, example: null }) encerradoEm: string | null;
  @ApiProperty({ example: false, description: 'true se o sistema encerrou sozinho (ex.: a comunicação voltou).' }) encerradoAutomatico: boolean;
  @ApiProperty({ nullable: true, type: String, example: null }) motivoEncerramento: string | null;
  @ApiProperty({ nullable: true, type: EventoDoAlerta, description: 'Sismo que originou o alerta (null nos alertas de comunicação).' }) evento: EventoDoAlerta | null;
  @ApiProperty({ nullable: true, type: EstacaoDoAlerta, description: 'Estação do alerta (alertas de comunicação).' }) estacao: EstacaoDoAlerta | null;
  @ApiProperty({ type: ContagemReplicas }) _count: ContagemReplicas;
}

export class PaginaAlertasResposta {
  @ApiProperty({ example: 6 }) total: number;
  @ApiProperty({ example: 1 }) pagina: number;
  @ApiProperty({ example: 25 }) limite: number;
  @ApiProperty({ type: [AlertaResumoResposta] }) itens: AlertaResumoResposta[];
}

class ReplicaDoAlerta {
  @ApiProperty({ example: 1820 }) id: number;
  @ApiProperty({ example: 4.7 }) magnitude: number;
  @ApiProperty({ example: '51 km E of Ishinomaki, Japan' }) local: string;
  @ApiProperty({ example: ISO }) ocorridoEm: string;
}
class HistoricoDoAlerta {
  @ApiProperty({ example: 101 }) id: number;
  @ApiProperty({ example: 'RECONHECIDO', description: 'Ação registrada (ABERTO, ESCALADO, RECONHECIDO, ENCERRADO...).' }) acao: string;
  @ApiProperty({ nullable: true, type: String, example: 'Reconhecido por admin@iot.local' }) detalhes: string | null;
  @ApiProperty({ nullable: true, type: Number, example: 1 }) usuarioId: number | null;
  @ApiProperty({ example: ISO }) criadoEm: string;
}
class EstacaoProxima {
  @ApiProperty({ example: 4 }) id: number;
  @ApiProperty({ example: 'JP-SENDAI' }) codigo: string;
  @ApiProperty({ example: 'Sendai' }) nome: string;
  @ApiProperty({ enum: Origem, enumName: 'Origem', example: Origem.SIMULADO }) origem: Origem;
  @ApiProperty({ example: 92.4, description: 'Distância do epicentro em km.' }) distanciaKm: number;
}

export class AlertaDetalheResposta extends AlertaResumoResposta {
  @ApiProperty({ nullable: true, type: String, example: null }) reconhecidoEm: string | null;
  @ApiProperty({ nullable: true, type: Number, example: null }) reconhecidoPorId: number | null;
  @ApiProperty({ type: [ReplicaDoAlerta], description: 'Sismos posteriores na mesma área, agrupados neste alerta.' }) replicas: ReplicaDoAlerta[];
  @ApiProperty({ type: [HistoricoDoAlerta], description: 'Linha do tempo do alerta.' }) historico: HistoricoDoAlerta[];
  @ApiProperty({ type: [EstacaoProxima], description: 'Estações até 300 km do epicentro.' }) estacoesProximas: EstacaoProxima[];
}

// ---------- Perfil ----------

export class PerfilResposta {
  @ApiProperty({ example: 'admin@iot.local' }) email: string;
  @ApiProperty({ enum: Papel, enumName: 'Papel', example: Papel.ADMIN }) papel: Papel;
  @ApiProperty({ example: '2026-01-05T10:00:00.000Z' }) criadoEm: string;
  @ApiProperty({ nullable: true, type: String, example: 'Maria Souza' }) nome: string | null;
  @ApiProperty({ nullable: true, type: String, example: '52998224725', description: 'Somente dígitos.' }) cpf: string | null;
  @ApiProperty({ nullable: true, type: String, example: '11987654321', description: 'DDD + 9 dígitos.' }) celular: string | null;
  @ApiProperty({ nullable: true, type: String, example: '01310100', description: 'Somente dígitos.' }) cep: string | null;
  @ApiProperty({ nullable: true, type: String, example: 'Avenida Paulista' }) logradouro: string | null;
  @ApiProperty({ nullable: true, type: String, example: '1000' }) numero: string | null;
  @ApiProperty({ nullable: true, type: String, example: 'Sala 12' }) complemento: string | null;
  @ApiProperty({ nullable: true, type: String, example: 'Bela Vista' }) bairro: string | null;
  @ApiProperty({ nullable: true, type: String, example: 'São Paulo' }) cidade: string | null;
  @ApiProperty({ nullable: true, type: String, example: 'SP' }) uf: string | null;
  @ApiProperty({ example: true, description: 'Se o usuário já enviou um avatar.' }) temAvatar: boolean;
  @ApiProperty({ example: true, description: 'true quando todos os dados obrigatórios do perfil estão preenchidos.' }) completo: boolean;
}

export class ImagemAcervoResposta {
  @ApiProperty({ example: 7 }) id: number;
  @ApiProperty({ example: 'sismografo.png' }) nomeOriginal: string;
  @ApiProperty({ example: 'image/png' }) mime: string;
  @ApiProperty({ example: 184320, description: 'Tamanho em bytes.' }) tamanho: number;
  @ApiProperty({ example: ISO }) criadaEm: string;
}

// ---------- Usuarios (gestao pelo ADMIN) ----------

export class UsuarioListaResposta {
  @ApiProperty({ example: 2 }) id: number;
  @ApiProperty({ example: 'analista@empresa.com' }) email: string;
  @ApiProperty({ enum: Papel, enumName: 'Papel', example: Papel.VISUALIZADOR }) papel: Papel;
  @ApiProperty({ nullable: true, type: String, example: 'Maria Souza', description: 'Nome do perfil (null até a pessoa preencher).' }) nome: string | null;
  @ApiProperty({ example: '2026-01-05T10:00:00.000Z' }) criadoEm: string;
  @ApiProperty({ example: false, description: 'Se a pessoa já enviou um avatar.' }) temAvatar: boolean;
}

// ---------- Importacao de arquivo ----------

export class ErroLinhaImportacao {
  @ApiProperty({ example: 14, description: 'Linha do arquivo (o cabeçalho é a linha 1).' }) linha: number;
  @ApiProperty({ example: "Temperatura fora da faixa de -50 a 150 °C: 999." }) motivo: string;
}

export class ImportacaoResposta {
  @ApiProperty({ example: 1200, description: 'Linhas de dados lidas do arquivo (sem o cabeçalho).' }) linhasLidas: number;
  @ApiProperty({ example: 1185, description: 'Leituras gravadas.' }) importadas: number;
  @ApiProperty({ example: 10, description: 'Linhas ignoradas por repetirem um id (no arquivo ou já existente no banco).' }) ignoradas: number;
  @ApiProperty({ example: 5, description: 'Total de linhas recusadas pela validação.' }) totalRejeitadas: number;
  @ApiProperty({ type: [ErroLinhaImportacao], description: 'As primeiras 50 linhas recusadas, com o motivo.' }) rejeitadas: ErroLinhaImportacao[];
}
