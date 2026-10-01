import { Controller, MessageEvent, Sse } from '@nestjs/common';
import { ApiOperation, ApiProduces, ApiResponse, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { Observable, interval, map, merge, of, takeUntil, timer } from 'rxjs';
import { Autenticada, TAGS } from '../comum/swagger';
import { TempoRealService } from './tempo-real.service';

const BATIMENTO_MS = 25_000; // mantem a conexao viva atras de proxies (nginx corta conexao parada)
// A conexao se encerra sozinha: o cliente reconecta e o token e conferido de novo. Assim um token
// expirado ou revogado nao segura o canal aberto para sempre.
const DURACAO_MAXIMA_MS = 10 * 60_000;

@ApiTags(TAGS.tempoReal)
@Autenticada()
@Controller('tempo-real')
export class TempoRealController {
  constructor(private readonly tempoReal: TempoRealService) {}

  @ApiOperation({
    summary: 'Avisos em tempo real (SSE)',
    description:
      'Mantém uma conexão aberta (`text/event-stream`) e envia um aviso sempre que algo muda, para o painel se atualizar sem recarregar.\n\n' +
      '**Eventos:** `conectado` (ao abrir), `alerta` (alerta aberto, reconhecido, encerrado ou reclassificado), `sismos` (novos terremotos do USGS), ' +
      '`leituras` (novas leituras de estações ou importação de arquivo) e `ping` (batimento a cada 25 s).\n\n' +
      'Os avisos **não carregam dados sensíveis**: dizem só o que mudou; o cliente busca o resto pelas rotas normais, com as próprias permissões. ' +
      'A conexão encerra a cada 10 minutos e o cliente reconecta (o token é conferido de novo).\n\n' +
      '**Atenção:** o `EventSource` do navegador não envia o cabeçalho `Authorization`; use `fetch` com leitura do corpo em fluxo (é o que o painel faz). ' +
      'O botão *Execute* do Swagger não mostra o fluxo em tempo real: teste com `curl -N -H "Authorization: Bearer <token>" http://localhost:3000/api/tempo-real`.',
  })
  @ApiProduces('text/event-stream')
  @ApiResponse({
    status: 200,
    description: 'Fluxo de eventos. Exemplo: `event: alerta` + `data: {"id":37,"acao":"aberto"}`.',
    content: { 'text/event-stream': { schema: { type: 'string', example: 'event: alerta\ndata: {"id":37,"acao":"aberto"}\n\n' } } },
  })
  @SkipThrottle()
  @Sse()
  fluxo(): Observable<MessageEvent> {
    const avisos = this.tempoReal.eventos$.pipe(map((e) => ({ type: e.tipo, data: e.dados ?? {} })));
    const batimento = interval(BATIMENTO_MS).pipe(map(() => ({ type: 'ping', data: {} })));
    return merge(of({ type: 'conectado', data: {} }), avisos, batimento).pipe(takeUntil(timer(DURACAO_MAXIMA_MS)));
  }
}
