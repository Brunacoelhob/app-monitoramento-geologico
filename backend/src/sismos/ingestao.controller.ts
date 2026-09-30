import { Body, Controller, HttpCode, Post, Req, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Publica } from '../auth/decoradores';
import { ChaveEstacaoGuard } from './chave-estacao.guard';
import { IngestaoDto } from './dto/ingestao.dto';
import { IngestaoService } from './ingestao.service';

// Rota publica para o login de usuario (@Publica), mas protegida pela chave da estacao.
@Controller('ingestao')
export class IngestaoController {
  constructor(private readonly ingestao: IngestaoService) {}

  @Publica()
  @UseGuards(ChaveEstacaoGuard)
  @Throttle({ default: { limit: 300, ttl: 60_000 } })
  @HttpCode(200)
  @Post('leituras')
  receber(@Body() dto: IngestaoDto, @Req() requisicao: { estacao: Parameters<IngestaoService['ingerir']>[0] }) {
    return this.ingestao.ingerir(requisicao.estacao, dto.leituras);
  }
}
