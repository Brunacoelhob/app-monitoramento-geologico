import { Body, Controller, HttpCode, Post, Req, UseGuards } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiSecurity,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Publica } from '../auth/decoradores';
import { ErroApi, ResultadoIngestaoResposta } from '../comum/respostas.dto';
import { TAGS } from '../comum/swagger';
import { ChaveEstacaoGuard } from './chave-estacao.guard';
import { IngestaoDto } from './dto/ingestao.dto';
import { IngestaoService } from './ingestao.service';

// Rota publica para o login de usuario (@Publica), mas protegida pela chave da estacao.
@ApiTags(TAGS.ingestao)
@Controller('ingestao')
export class IngestaoController {
  constructor(private readonly ingestao: IngestaoService) {}

  // Autentica pela chave da estacao (nao pelo JWT): o botao Authorize tem o esquema "chave-estacao".
  @ApiOperation({
    summary: 'Enviar leituras de uma estação',
    description:
      'Usado pela **estação** (sensor real ou simulador), não por pessoas. Autentica pela chave no cabeçalho `x-chave-estacao` ' +
      '(botão **Authorize → chave-estacao**), sem login de usuário.\n\n' +
      '**Como funciona:** envie de 1 a 500 leituras. Cada uma é validada separadamente (sensor da própria estação, ativo, ' +
      'instante não futuro, valores plausíveis). As boas são gravadas; as ruins voltam em `rejeitadas` com o motivo e a posição. ' +
      'Leituras repetidas (mesmo sensor e mesmo instante) são ignoradas, então reenviar um lote é seguro.\n\n' +
      '**Campos por tipo de sensor:** TEMPERATURA → `temperatura`; SISMOGRAFO → `amplitude`; GPS → `latitude` e `longitude` ' +
      '(+ opcionais `altitudeM`, `deslocamentoLesteMm`, `deslocamentoNorteMm`).\n\n' +
      'Ao receber leituras, um alerta de "sem comunicação" aberto para a estação é encerrado sozinho. Limite de 300 chamadas por minuto.',
  })
  @ApiSecurity('chave-estacao')
  @ApiOkResponse({ description: 'Lote processado (mesmo que parte das leituras tenha sido rejeitada).', type: ResultadoIngestaoResposta })
  @ApiBadRequestResponse({ description: 'Corpo inválido: lista vazia, mais de 500 leituras ou campo com tipo errado.', type: ErroApi })
  @ApiUnauthorizedResponse({ description: 'Chave ausente, com tamanho inválido ou desconhecida.', type: ErroApi })
  @ApiForbiddenResponse({ description: 'A estação dona da chave está inativa e não recebe leituras.', type: ErroApi })
  @ApiTooManyRequestsResponse({ description: 'Mais de 300 chamadas em 1 minuto.', type: ErroApi })
  @Publica()
  @UseGuards(ChaveEstacaoGuard)
  @Throttle({ default: { limit: 300, ttl: 60_000 } })
  @HttpCode(200)
  @Post('leituras')
  receber(@Body() dto: IngestaoDto, @Req() requisicao: { estacao: Parameters<IngestaoService['ingerir']>[0] }) {
    return this.ingestao.ingerir(requisicao.estacao, dto.leituras);
  }
}
