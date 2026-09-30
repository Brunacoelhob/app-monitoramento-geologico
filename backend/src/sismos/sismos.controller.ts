import { Body, Controller, Get, Param, ParseIntPipe, Post, Put, Query, Res } from '@nestjs/common';
import { Papel } from '@prisma/client';
import { Throttle } from '@nestjs/throttler';
import { Response } from 'express';
import { Papeis, UsuarioAtual, UsuarioLogado } from '../auth/decoradores';
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

@Controller('estacoes')
export class EstacoesController {
  constructor(private readonly estacoes: EstacoesService) {}

  @Get()
  listar() {
    return this.estacoes.listar();
  }

  @Get(':id')
  obter(@Param('id', ParseIntPipe) id: number) {
    return this.estacoes.obter(id);
  }

  @Get(':id/series')
  series(@Param('id', ParseIntPipe) id: number, @Query() consulta: SeriesEstacaoDto) {
    return this.estacoes.series(id, consulta.horas);
  }

  @Papeis(Papel.ADMIN)
  @Post()
  criar(@Body() dto: CriarEstacaoDto) {
    return this.estacoes.criar(dto);
  }

  @Papeis(Papel.ADMIN)
  @Put(':id')
  atualizar(@Param('id', ParseIntPipe) id: number, @Body() dto: AtualizarEstacaoDto) {
    return this.estacoes.atualizar(id, dto);
  }

  @Papeis(Papel.ADMIN)
  @Put(':id/situacao')
  situacao(@Param('id', ParseIntPipe) id: number, @Body() dto: SituacaoEstacaoDto) {
    return this.estacoes.definirSituacao(id, dto.ativa);
  }

  @Papeis(Papel.ADMIN)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post(':id/chave')
  novaChave(@Param('id', ParseIntPipe) id: number) {
    return this.estacoes.gerarNovaChave(id);
  }

  @Papeis(Papel.ADMIN)
  @Post(':id/sensores')
  adicionarSensor(@Param('id', ParseIntPipe) id: number, @Body() dto: SensorDto) {
    return this.estacoes.adicionarSensor(id, dto);
  }
}

@Controller('eventos')
export class EventosController {
  constructor(
    private readonly eventos: EventosService,
    private readonly usgs: UsgsService,
    private readonly relatorio: RelatorioSismosService,
  ) {}

  @Get()
  listar(@Query() consulta: ConsultaEventosDto) {
    return this.eventos.listar(consulta);
  }

  @Get('regioes')
  regioes(@Query() filtros: ConsultaEventosDto) {
    return this.eventos.regioes(filtros);
  }

  @Get('periodo')
  periodo() {
    return this.eventos.periodo();
  }

  @Get('totais')
  totais(@Query() filtros: ConsultaEventosDto) {
    return this.eventos.totais(filtros);
  }

  @Get('serie-diaria')
  serieDiaria(@Query() filtros: ConsultaEventosDto) {
    return this.eventos.serieDiaria(filtros);
  }

  @Get('mapa')
  mapa(@Query() filtros: ConsultaEventosDto) {
    return this.eventos.mapa(filtros);
  }

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Get('relatorio')
  baixarRelatorio(@Query() consulta: ConsultaRelatorioEventosDto, @Res() res: Response) {
    return this.relatorio.gerar(consulta, res);
  }

  // Forca uma sincronizacao com o USGS agora (alem da automatica a cada 10 min).
  @Papeis(Papel.ADMIN)
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @Post('sincronizar')
  sincronizar() {
    return this.usgs.sincronizar();
  }
}

@Controller('alertas')
export class AlertasController {
  constructor(private readonly alertas: AlertasService) {}

  @Get()
  listar(@Query() consulta: ConsultaAlertasDto) {
    return this.alertas.listar(consulta);
  }

  @Get(':id')
  obter(@Param('id', ParseIntPipe) id: number) {
    return this.alertas.obter(id);
  }

  @Papeis(Papel.ADMIN)
  @Put(':id/reconhecer')
  reconhecer(@Param('id', ParseIntPipe) id: number, @UsuarioAtual() usuario: UsuarioLogado) {
    return this.alertas.reconhecer(id, usuario);
  }

  @Papeis(Papel.ADMIN)
  @Put(':id/encerrar')
  encerrar(@Param('id', ParseIntPipe) id: number, @UsuarioAtual() usuario: UsuarioLogado, @Body() dto: EncerrarAlertaDto) {
    return this.alertas.encerrar(id, usuario, dto.motivo);
  }
}
