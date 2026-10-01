import { Body, Controller, Get, Param, ParseIntPipe, Post, Put, Query, Res } from '@nestjs/common';
import { Papel } from '@prisma/client';
import { ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiParam, ApiProduces, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Response } from 'express';
import { Papeis, UsuarioAtual, UsuarioLogado } from '../auth/decoradores';
import {
  AlertaDetalheResposta,
  AlertaResumoResposta,
  DiaSismosResposta,
  EstacaoCriadaResposta,
  EstacaoResposta,
  NovaChaveResposta,
  PaginaAlertasResposta,
  PaginaEventosResposta,
  PeriodoResposta,
  PontoMapaResposta,
  RegioesResposta,
  SeriesEstacaoResposta,
  SincronizacaoResposta,
  TotaisSismosResposta,
} from '../comum/respostas.dto';
import { Autenticada, Conflito, Invalida, NaoEncontrada, SomenteAdmin, TAGS } from '../comum/swagger';
import { AlertasService } from './alertas.service';
import { AtualizarEstacaoDto, CriarEstacaoDto, SensorDto, SituacaoEstacaoDto } from './dto/estacoes.dto';
import {
  ConsultaAlertasDto,
  ConsultaEventosDto,
  ConsultaRelatorioEventosDto,
  EncerrarAlertaDto,
  SeriesEstacaoDto,
} from './dto/eventos.dto';
import { EstacoesService } from './estacoes.service';
import { EventosService } from './eventos.service';
import { RelatorioSismosService } from './relatorio-sismos.service';
import { UsgsService } from './usgs.service';

// Leitura: qualquer usuario logado. Escrita: so ADMIN (RN-26) — a ingestao tem controller proprio.

const ID_ESTACAO = { name: 'id', description: 'Id da estação (veja em GET /estacoes).', example: 4 };
const ID_ALERTA = { name: 'id', description: 'Id do alerta (veja em GET /alertas).', example: 37 };

@ApiTags(TAGS.estacoes)
@Autenticada()
@Controller('estacoes')
export class EstacoesController {
  constructor(private readonly estacoes: EstacoesService) {}

  @ApiOperation({
    summary: 'Listar estações',
    description:
      'Todas as estações com seus sensores, origem (REAL/SIMULADO), a última leitura recebida e se estão **online** ' +
      '(enviaram leitura dentro da janela de comunicação). A chave de API nunca é devolvida; `temChave` só indica se existe.',
  })
  @ApiOkResponse({ description: 'Lista de estações.', type: [EstacaoResposta] })
  @Get()
  listar() {
    return this.estacoes.listar();
  }

  @ApiOperation({ summary: 'Detalhar uma estação', description: 'Mesmos dados de um item de GET /estacoes.' })
  @ApiParam(ID_ESTACAO)
  @ApiOkResponse({ description: 'Estação encontrada.', type: EstacaoResposta })
  @Invalida('O id não é um número inteiro.')
  @NaoEncontrada('Estação não encontrada.')
  @Get(':id')
  obter(@Param('id', ParseIntPipe) id: number) {
    return this.estacoes.obter(id);
  }

  @ApiOperation({
    summary: 'Séries recentes da estação',
    description: 'Sismógrafo, GPS e temperatura das últimas `horas` (1 a 72, padrão 24), lado a lado, para os gráficos da estação.',
  })
  @ApiParam(ID_ESTACAO)
  @ApiOkResponse({ description: 'Séries da janela pedida.', type: SeriesEstacaoResposta })
  @Invalida('Id ou `horas` inválidos (horas vai de 1 a 72).')
  @NaoEncontrada('Estação não encontrada.')
  @Get(':id/series')
  series(@Param('id', ParseIntPipe) id: number, @Query() consulta: SeriesEstacaoDto) {
    return this.estacoes.series(id, consulta.horas);
  }

  @ApiOperation({
    summary: 'Cadastrar estação',
    description:
      '**Somente ADMIN.** Cria a estação com seus sensores e devolve a **chave de API em texto puro, uma única vez**. ' +
      'Guarde-a: depois só existe o hash no banco (para trocar, use POST /estacoes/{id}/chave).\n\n' +
      'Sensores de TEMPERATURA exigem `sentido` (INTERNO/EXTERNO); os demais não podem ter sentido.',
  })
  @ApiCreatedResponse({ description: 'Estação criada, com a chave de API.', type: EstacaoCriadaResposta })
  @Invalida('Código fora do padrão, sensor inválido (ex.: temperatura sem sentido) ou campo fora da faixa.')
  @SomenteAdmin()
  @Conflito('Já existe uma estação com este código.')
  @Papeis(Papel.ADMIN)
  @Post()
  criar(@Body() dto: CriarEstacaoDto) {
    return this.estacoes.criar(dto);
  }

  @ApiOperation({
    summary: 'Atualizar dados da estação',
    description: '**Somente ADMIN.** Altera nome, coordenadas e placa. Envie apenas o que mudou; o código e a origem não mudam.',
  })
  @ApiParam(ID_ESTACAO)
  @ApiOkResponse({ description: 'Estação atualizada.', type: EstacaoResposta })
  @Invalida()
  @SomenteAdmin()
  @NaoEncontrada('Estação não encontrada.')
  @Papeis(Papel.ADMIN)
  @Put(':id')
  atualizar(@Param('id', ParseIntPipe) id: number, @Body() dto: AtualizarEstacaoDto) {
    return this.estacoes.atualizar(id, dto);
  }

  @ApiOperation({
    summary: 'Ativar ou desativar estação',
    description:
      '**Somente ADMIN.** Estação inativa deixa de receber leituras (a ingestão devolve 403), mas o histórico é mantido.',
  })
  @ApiParam(ID_ESTACAO)
  @ApiOkResponse({ description: 'Estação com a nova situação.', type: EstacaoResposta })
  @Invalida()
  @SomenteAdmin()
  @NaoEncontrada('Estação não encontrada.')
  @Papeis(Papel.ADMIN)
  @Put(':id/situacao')
  situacao(@Param('id', ParseIntPipe) id: number, @Body() dto: SituacaoEstacaoDto) {
    return this.estacoes.definirSituacao(id, dto.ativa);
  }

  @ApiOperation({
    summary: 'Gerar nova chave de API',
    description:
      '**Somente ADMIN.** Cria outra chave e **invalida a anterior na hora**; a nova aparece só nesta resposta. ' +
      'Limite de 5 chamadas por minuto.',
  })
  @ApiParam(ID_ESTACAO)
  @ApiCreatedResponse({ description: 'Nova chave (mostrada uma única vez).', type: NovaChaveResposta })
  @SomenteAdmin()
  @NaoEncontrada('Estação não encontrada.')
  @Papeis(Papel.ADMIN)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post(':id/chave')
  novaChave(@Param('id', ParseIntPipe) id: number) {
    return this.estacoes.gerarNovaChave(id);
  }

  @ApiOperation({
    summary: 'Adicionar sensor à estação',
    description: '**Somente ADMIN.** Acrescenta um sensor. Temperatura exige `sentido`; sismógrafo e GPS não aceitam `sentido`.',
  })
  @ApiParam(ID_ESTACAO)
  @ApiCreatedResponse({ description: 'Estação com o novo sensor na lista.', type: EstacaoResposta })
  @Invalida('Sensor inválido (ex.: temperatura sem sentido).')
  @SomenteAdmin()
  @NaoEncontrada('Estação não encontrada.')
  @Papeis(Papel.ADMIN)
  @Post(':id/sensores')
  adicionarSensor(@Param('id', ParseIntPipe) id: number, @Body() dto: SensorDto) {
    return this.estacoes.adicionarSensor(id, dto);
  }
}

@ApiTags(TAGS.eventos)
@Autenticada()
@Controller('eventos')
export class EventosController {
  constructor(
    private readonly eventos: EventosService,
    private readonly usgs: UsgsService,
    private readonly relatorio: RelatorioSismosService,
  ) {}

  @ApiOperation({
    summary: 'Listar sismos (paginado)',
    description:
      'Terremotos importados do USGS, do mais recente para o mais antigo. Todos os filtros são opcionais e combináveis. ' +
      'Cada item indica se gerou um alerta (`alertaId`) ou se é réplica de um alerta (`replicaDoAlertaId`).',
  })
  @ApiOkResponse({ description: 'Página de sismos.', type: PaginaEventosResposta })
  @Invalida()
  @NaoEncontrada('Estação do filtro `estacaoId` não encontrada.')
  @Get()
  listar(@Query() consulta: ConsultaEventosDto) {
    return this.eventos.listar(consulta);
  }

  @ApiOperation({
    summary: 'Regiões do mundo',
    description:
      'Cada região (caixa geográfica) com placas envolvidas, texto de contexto geológico, **quantos sismos** e a maior magnitude no período. ' +
      'Usa todos os filtros **exceto** `regiao` (senão só uma região teria números). Alimenta o mapa-múndi clicável.',
  })
  @ApiOkResponse({ description: 'Regiões com estatísticas.', type: RegioesResposta })
  @Invalida()
  @Get('regioes')
  regioes(@Query() filtros: ConsultaEventosDto) {
    return this.eventos.regioes(filtros);
  }

  @ApiOperation({ summary: 'Período com dados', description: 'Primeira e última data com sismos importados (`null` se ainda não há).' })
  @ApiOkResponse({ description: 'Intervalo disponível.', type: PeriodoResposta })
  @Get('periodo')
  periodo() {
    return this.eventos.periodo();
  }

  @ApiOperation({
    summary: 'Totais do período',
    description: 'Total de sismos, maior magnitude, contagem por nível, alertas abertos por nível e estações ativas/online.',
  })
  @ApiOkResponse({ description: 'Indicadores.', type: TotaisSismosResposta })
  @Invalida()
  @Get('totais')
  totais(@Query() filtros: ConsultaEventosDto) {
    return this.eventos.totais(filtros);
  }

  @ApiOperation({ summary: 'Série diária', description: 'Quantidade de sismos e maior magnitude de cada dia do período. Alimenta os gráficos.' })
  @ApiOkResponse({ description: 'Um item por dia com sismos.', type: [DiaSismosResposta] })
  @Invalida()
  @Get('serie-diaria')
  serieDiaria(@Query() filtros: ConsultaEventosDto) {
    return this.eventos.serieDiaria(filtros);
  }

  @ApiOperation({
    summary: 'Pontos do mapa',
    description: 'Versão enxuta dos sismos (posição, magnitude e profundidade) para desenhar o mapa, sem paginação.',
  })
  @ApiOkResponse({ description: 'Pontos dos sismos filtrados.', type: [PontoMapaResposta] })
  @Invalida()
  @Get('mapa')
  mapa(@Query() filtros: ConsultaEventosDto) {
    return this.eventos.mapa(filtros);
  }

  @ApiOperation({
    summary: 'Baixar relatório de sismos',
    description:
      'Gera **pdf**, **xlsx** ou **csv** com os sismos e alertas do período, com os mesmos filtros da listagem. ' +
      'No Swagger, use **Execute** e depois **Download file**. Limite de 10 relatórios por minuto.',
  })
  @ApiProduces('application/pdf', 'text/csv', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  @ApiResponse({
    status: 200,
    description: 'Arquivo do relatório (`Content-Disposition: attachment`).',
    content: {
      'application/pdf': { schema: { type: 'string', format: 'binary' } },
      'text/csv': { schema: { type: 'string', format: 'binary' } },
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': { schema: { type: 'string', format: 'binary' } },
    },
  })
  @Invalida('Formato inválido, filtro inválido ou período grande demais para xlsx/csv.')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Get('relatorio')
  baixarRelatorio(@Query() consulta: ConsultaRelatorioEventosDto, @Res() res: Response) {
    return this.relatorio.gerar(consulta, res);
  }

  // Forca uma sincronizacao com o USGS agora (alem da automatica a cada 10 min).
  @ApiOperation({
    summary: 'Sincronizar com o USGS agora',
    description:
      '**Somente ADMIN.** Busca imediatamente os terremotos no USGS (Japão M4,0+ e mundo M4,5+), além da sincronização automática a cada 10 minutos. ' +
      'Limite de 3 chamadas por minuto.',
  })
  @ApiCreatedResponse({ description: 'Resumo da sincronização.', type: SincronizacaoResposta })
  @SomenteAdmin()
  @Papeis(Papel.ADMIN)
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @Post('sincronizar')
  sincronizar() {
    return this.usgs.sincronizar();
  }
}

@ApiTags(TAGS.alertas)
@Autenticada()
@Controller('alertas')
export class AlertasController {
  constructor(private readonly alertas: AlertasService) {}

  @ApiOperation({
    summary: 'Listar alertas (paginado)',
    description:
      'Alertas de **sismo** (só em regiões monitoradas, hoje o Japão) e de **estação sem comunicação**. ' +
      'Níveis: ATENCAO, ALTO, CRITICO. Estados: ABERTO → RECONHECIDO → ENCERRADO.',
  })
  @ApiOkResponse({ description: 'Página de alertas.', type: PaginaAlertasResposta })
  @Invalida()
  @Get()
  listar(@Query() consulta: ConsultaAlertasDto) {
    return this.alertas.listar(consulta);
  }

  @ApiOperation({
    summary: 'Detalhar um alerta',
    description: 'Inclui o sismo de origem, as réplicas agrupadas, a linha do tempo (histórico) e as estações a até 300 km do epicentro.',
  })
  @ApiParam(ID_ALERTA)
  @ApiOkResponse({ description: 'Alerta completo.', type: AlertaDetalheResposta })
  @Invalida('O id não é um número inteiro.')
  @NaoEncontrada('Alerta não encontrado.')
  @Get(':id')
  obter(@Param('id', ParseIntPipe) id: number) {
    return this.alertas.obter(id);
  }

  @ApiOperation({
    summary: 'Reconhecer alerta',
    description: '**Somente ADMIN.** Marca que alguém viu o alerta (ABERTO → RECONHECIDO) e registra quem e quando no histórico.',
  })
  @ApiParam(ID_ALERTA)
  @ApiOkResponse({ description: 'Alerta reconhecido.', type: AlertaResumoResposta })
  @SomenteAdmin()
  @NaoEncontrada('Alerta não encontrado.')
  @Conflito('Só alertas com estado ABERTO podem ser reconhecidos.')
  @Papeis(Papel.ADMIN)
  @Put(':id/reconhecer')
  reconhecer(@Param('id', ParseIntPipe) id: number, @UsuarioAtual() usuario: UsuarioLogado) {
    return this.alertas.reconhecer(id, usuario);
  }

  @ApiOperation({
    summary: 'Encerrar alerta',
    description:
      '**Somente ADMIN.** Encerra o alerta (→ ENCERRADO). Se ele **ainda não foi reconhecido**, o `motivo` é obrigatório. ' +
      'Alertas já encerrados não podem ser encerrados de novo.',
  })
  @ApiParam(ID_ALERTA)
  @ApiOkResponse({ description: 'Alerta encerrado.', type: AlertaResumoResposta })
  @Invalida('Falta o `motivo` (obrigatório para alerta não reconhecido) ou ele passa de 300 caracteres.')
  @SomenteAdmin()
  @NaoEncontrada('Alerta não encontrado.')
  @Conflito('Este alerta já está encerrado.')
  @Papeis(Papel.ADMIN)
  @Put(':id/encerrar')
  encerrar(@Param('id', ParseIntPipe) id: number, @UsuarioAtual() usuario: UsuarioLogado, @Body() dto: EncerrarAlertaDto) {
    return this.alertas.encerrar(id, usuario, dto.motivo);
  }
}
