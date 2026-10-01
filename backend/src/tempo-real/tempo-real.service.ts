import { Injectable } from '@nestjs/common';
import { Subject } from 'rxjs';

export type TipoTempoReal = 'alerta' | 'sismos' | 'leituras';

export interface EventoTempoReal {
  tipo: TipoTempoReal;
  dados?: Record<string, unknown>;
}

// Menor intervalo entre dois avisos do mesmo tipo: o simulador grava a cada minuto em varias estacoes e
// ninguem precisa de um aviso por gravacao. O ultimo aviso do intervalo nunca se perde.
const INTERVALO_MINIMO_MS = 1500;

// Barramento interno: qualquer parte do backend avisa "algo mudou" e o canal SSE repassa aos navegadores.
// Os avisos so dizem O QUE mudou; quem recebe busca os dados pela API normal, com as suas permissoes.
@Injectable()
export class TempoRealService {
  private readonly canal = new Subject<EventoTempoReal>();
  readonly eventos$ = this.canal.asObservable();

  private readonly ultimo = new Map<TipoTempoReal, number>();
  private readonly pendente = new Map<TipoTempoReal, ReturnType<typeof setTimeout>>();

  emitir(tipo: TipoTempoReal, dados?: Record<string, unknown>): void {
    const agora = Date.now();
    const espera = (this.ultimo.get(tipo) ?? 0) + INTERVALO_MINIMO_MS - agora;

    if (espera <= 0) {
      this.ultimo.set(tipo, agora);
      this.canal.next({ tipo, dados });
      return;
    }

    // Dentro do intervalo: guarda so o aviso mais recente e o envia quando o intervalo acabar
    const antigo = this.pendente.get(tipo);
    if (antigo) clearTimeout(antigo);
    this.pendente.set(
      tipo,
      setTimeout(() => {
        this.pendente.delete(tipo);
        this.ultimo.set(tipo, Date.now());
        this.canal.next({ tipo, dados });
      }, espera),
    );
  }
}
