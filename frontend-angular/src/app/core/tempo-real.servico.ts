import { Injectable, effect, inject, signal, untracked } from '@angular/core';
import { Subject } from 'rxjs';
import { AuthServico } from './auth.servico';

export type TipoAviso = 'alerta' | 'sismos' | 'leituras';

export interface AvisoTempoReal {
  tipo: TipoAviso;
  dados: Record<string, unknown>;
}

const TIPOS: TipoAviso[] = ['alerta', 'sismos', 'leituras'];

// Converte um bloco do fluxo SSE ("event: alerta\ndata: {...}") em um aviso.
// Devolve null para o que nao interessa (batimento "ping", "conectado", comentarios, JSON quebrado).
export function analisarBlocoSse(bloco: string): AvisoTempoReal | null {
  let tipo = '';
  let dados = '';
  for (const linha of bloco.split('\n')) {
    if (linha.startsWith('event:')) tipo = linha.slice(6).trim();
    else if (linha.startsWith('data:')) dados += linha.slice(5).trim();
  }
  if (!TIPOS.includes(tipo as TipoAviso)) return null;
  try {
    const valor = dados ? JSON.parse(dados) : {};
    return { tipo: tipo as TipoAviso, dados: valor && typeof valor === 'object' ? valor : {} };
  } catch {
    return null;
  }
}

const ESPERA_MAXIMA_MS = 30_000;

// Mantem aberto o canal de avisos do backend (SSE) enquanto ha alguem logado e repassa cada aviso, para o
// painel se atualizar sozinho. Usa fetch em vez de EventSource porque o EventSource nao envia o cabecalho
// Authorization. Se a conexao cair, tenta de novo com espera crescente.
@Injectable({ providedIn: 'root' })
export class TempoRealServico {
  private readonly auth = inject(AuthServico);
  private readonly _avisos = new Subject<AvisoTempoReal>();

  readonly avisos$ = this._avisos.asObservable();
  readonly conectado = signal(false);

  constructor() {
    effect((limpar) => {
      const token = this.auth.token();
      if (!token) {
        untracked(() => this.conectado.set(false));
        return;
      }
      const controle = new AbortController();
      void this.manterConexao(token, controle.signal);
      limpar(() => controle.abort());
    });
  }

  private async manterConexao(token: string, sinal: AbortSignal): Promise<void> {
    let tentativa = 0;
    while (!sinal.aborted) {
      try {
        const resposta = await fetch('/api/tempo-real', {
          headers: { Authorization: `Bearer ${token}`, Accept: 'text/event-stream' },
          signal: sinal,
        });
        // Token vencido ou sem permissao: nao adianta insistir (o proximo pedido normal leva ao login)
        if (resposta.status === 401 || resposta.status === 403) return;
        if (!resposta.ok || !resposta.body) throw new Error(`Canal respondeu ${resposta.status}.`);

        const leitor = resposta.body.pipeThrough(new TextDecoderStream()).getReader();
        let pendente = '';
        for (;;) {
          const { value, done } = await leitor.read();
          if (done) break;
          pendente += value.replace(/\r\n/g, '\n');
          let corte: number;
          while ((corte = pendente.indexOf('\n\n')) !== -1) {
            const bloco = pendente.slice(0, corte);
            pendente = pendente.slice(corte + 2);
            if (bloco.includes('event: conectado')) {
              this.conectado.set(true);
              tentativa = 0;
            }
            const aviso = analisarBlocoSse(bloco);
            if (aviso) this._avisos.next(aviso);
          }
        }
      } catch {
        if (sinal.aborted) return;
      }

      // A conexao terminou (o servidor a encerra a cada 10 min) ou caiu: reconecta
      this.conectado.set(false);
      await this.esperar(Math.min(ESPERA_MAXIMA_MS, 1000 * 2 ** tentativa++), sinal);
    }
  }

  private esperar(ms: number, sinal: AbortSignal): Promise<void> {
    return new Promise((resolver) => {
      const temporizador = setTimeout(resolver, ms);
      sinal.addEventListener('abort', () => { clearTimeout(temporizador); resolver(); }, { once: true });
    });
  }
}
