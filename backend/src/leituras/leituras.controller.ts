import { Body, Controller, Get, Post, Query, Res } from '@nestjs/common';
import { Papel } from '@prisma/client';
import { Throttle } from '@nestjs/throttler';
import { Response } from 'express';
import { Papeis } from '../auth/decoradores';
import { ConsultaLeiturasDto } from './dto/consulta-leituras.dto';
import { ConsultaRelatorioDto } from './dto/consulta-relatorio.dto';
import { CriarLeituraDto } from './dto/criar-leitura.dto';
import { LeiturasService } from './leituras.service';
import { RelatoriosService } from './relatorios.service';

// Qualquer usuario logado le; so ADMIN cria (regra aplicada aqui no backend).
@Controller('leituras')
export class LeiturasController {
  constructor(
    private readonly leiturasService: LeiturasService,
    private readonly relatoriosService: RelatoriosService,
  ) {}

  @Get()
  listar(@Query() consulta: ConsultaLeiturasDto) {
    return this.leiturasService.listar(consulta);
  }

  @Get('periodo')
  periodo() {
    return this.leiturasService.periodo();
  }

  @Get('totais')
  totais(@Query() consulta: ConsultaLeiturasDto) {
    return this.leiturasService.totais(consulta);
  }

  @Get('serie-horaria')
  serieHoraria(@Query() consulta: ConsultaLeiturasDto) {
    return this.leiturasService.serieHoraria(consulta);
  }

  // Baixa o relatorio nos formatos pdf, xlsx ou csv (streaming direto na resposta).
  // Limite proprio: gerar relatorio e pesado e nao deve ser chamado em serie.
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Get('relatorio')
  relatorio(@Query() consulta: ConsultaRelatorioDto, @Res() res: Response) {
    return this.relatoriosService.gerar(consulta, res);
  }

  @Papeis(Papel.ADMIN)
  @Post()
  criar(@Body() dto: CriarLeituraDto) {
    return this.leiturasService.criar(dto);
  }
}
