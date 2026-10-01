import { Body, Controller, Get, Post, Query, Res } from '@nestjs/common';
import { Papel } from '@prisma/client';
import { ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiProduces, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Response } from 'express';
import { Papeis } from '../auth/decoradores';
import {
  LeituraResposta,
  PaginaLeiturasResposta,
  PeriodoResposta,
  PontoSerieHorariaResposta,
  TotaisLeiturasResposta,
} from '../comum/respostas.dto';
import { Autenticada, Conflito, Invalida, SomenteAdmin, TAGS } from '../comum/swagger';
import { ConsultaLeiturasDto } from './dto/consulta-leituras.dto';
import { ConsultaRelatorioDto } from './dto/consulta-relatorio.dto';
import { CriarLeituraDto } from './dto/criar-leitura.dto';
import { LeiturasService } from './leituras.service';
import { RelatoriosService } from './relatorios.service';

// Qualquer usuario logado le; so ADMIN cria (regra aplicada aqui no backend).
@ApiTags(TAGS.leituras)
@Autenticada()
@Controller('leituras')
export class LeiturasController {
  constructor(
    private readonly leiturasService: LeiturasService,
    private readonly relatoriosService: RelatoriosService,
  ) {}

  @ApiOperation({
    summary: 'Listar leituras (paginado)',
    description:
      'Leituras de temperatura, da mais recente para a mais antiga, com os filtros opcionais. ' +
      'Sem `inicio`/`fim` considera todo o histórico. Use `pagina` e `limite` (máx. 100) para percorrer os resultados.',
  })
  @ApiOkResponse({ description: 'Página de leituras.', type: PaginaLeiturasResposta })
  @Invalida()
  @Get()
  listar(@Query() consulta: ConsultaLeiturasDto) {
    return this.leiturasService.listar(consulta);
  }

  @ApiOperation({
    summary: 'Período com dados',
    description: 'Primeira e última data com leituras. Serve para limitar o calendário dos filtros. Devolve `null` nos dois campos se não há dados.',
  })
  @ApiOkResponse({ description: 'Intervalo de datas disponível.', type: PeriodoResposta })
  @Get('periodo')
  periodo() {
    return this.leiturasService.periodo();
  }

  @ApiOperation({
    summary: 'Totais e médias',
    description: 'Total de leituras, temperatura média, salas monitoradas e o resumo (média, mínima, máxima) por sentido, no período filtrado.',
  })
  @ApiOkResponse({ description: 'Indicadores do período.', type: TotaisLeiturasResposta })
  @Invalida()
  @Get('totais')
  totais(@Query() consulta: ConsultaLeiturasDto) {
    return this.leiturasService.totais(consulta);
  }

  @ApiOperation({
    summary: 'Série por hora',
    description: 'Temperatura média de cada hora, separada por sentido. Alimenta o gráfico de linha da tela Temperatura.',
  })
  @ApiOkResponse({ description: 'Pontos da série (hora × sentido).', type: [PontoSerieHorariaResposta] })
  @Invalida()
  @Get('serie-horaria')
  serieHoraria(@Query() consulta: ConsultaLeiturasDto) {
    return this.leiturasService.serieHoraria(consulta);
  }

  // Baixa o relatorio nos formatos pdf, xlsx ou csv (streaming direto na resposta).
  // Limite proprio: gerar relatorio e pesado e nao deve ser chamado em serie.
  @ApiOperation({
    summary: 'Baixar relatório de temperatura',
    description:
      'Gera o arquivo nos formatos **pdf**, **xlsx** (Excel) ou **csv** com os mesmos filtros da consulta. ' +
      'No Swagger, use **Execute** e depois o link **Download file**.\n\n' +
      'Em xlsx e csv há um teto de linhas; se o período for grande, a API devolve 400 pedindo para reduzir. O PDF não tem esse teto. ' +
      'Limite de **10 relatórios por minuto**.',
  })
  @ApiProduces('application/pdf', 'text/csv', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  @ApiResponse({
    status: 200,
    description: 'Arquivo do relatório (cabeçalho `Content-Disposition: attachment`).',
    content: {
      'application/pdf': { schema: { type: 'string', format: 'binary' } },
      'text/csv': { schema: { type: 'string', format: 'binary' } },
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': { schema: { type: 'string', format: 'binary' } },
    },
  })
  @Invalida('Formato inválido, filtro inválido ou período grande demais para xlsx/csv.')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Get('relatorio')
  relatorio(@Query() consulta: ConsultaRelatorioDto, @Res() res: Response) {
    return this.relatoriosService.gerar(consulta, res);
  }

  @ApiOperation({
    summary: 'Registrar leitura manualmente',
    description:
      '**Somente ADMIN.** Cadastra uma leitura avulsa (útil para testes). O `id` precisa ser único. ' +
      'A temperatura aceita de -50 a 150 °C com no máximo 1 casa decimal. ' +
      'Para enviar leituras de uma estação use **Ingestão → POST /ingestao/leituras**.',
  })
  @ApiCreatedResponse({ description: 'Leitura criada.', type: LeituraResposta })
  @Invalida()
  @SomenteAdmin()
  @Conflito('Já existe uma leitura com este id.')
  @Papeis(Papel.ADMIN)
  @Post()
  criar(@Body() dto: CriarLeituraDto) {
    return this.leiturasService.criar(dto);
  }
}
