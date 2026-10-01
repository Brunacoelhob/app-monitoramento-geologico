import { Module } from '@nestjs/common';
import { AgendadorService } from './agendador.service';
import { AlertasService } from './alertas.service';
import { ChaveEstacaoGuard } from './chave-estacao.guard';
import { EstacoesService } from './estacoes.service';
import { EventosService } from './eventos.service';
import { IngestaoController } from './ingestao.controller';
import { IngestaoService } from './ingestao.service';
import { NotificadorService } from './notificador.service';
import { RelatorioSismosService } from './relatorio-sismos.service';
import { SimuladorService } from './simulador.service';
import { AlertasController, EstacoesController, EventosController } from './sismos.controller';
import { UsgsService } from './usgs.service';

// Modulo de sismos: estacoes, ingestao, eventos do USGS, alertas e simulador.
// As regras estao em docs/regras-de-negocio-sismos.md.
@Module({
  controllers: [EstacoesController, EventosController, AlertasController, IngestaoController],
  providers: [
    EstacoesService,
    AlertasService,
    NotificadorService,
    EventosService,
    IngestaoService,
    UsgsService,
    SimuladorService,
    AgendadorService,
    RelatorioSismosService,
    ChaveEstacaoGuard,
  ],
  exports: [EstacoesService],
})
export class SismosModule {}
