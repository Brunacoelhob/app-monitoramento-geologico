import { Injectable, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { EMPTY, catchError, filter, forkJoin, map, merge, switchMap, tap } from 'rxjs';
import { FiltrosServico } from './filtros.servico';
import { LeiturasServico } from './leituras.servico';
import { Consulta, PontoSerie, Totais } from './modelos';
import { TempoRealServico } from './tempo-real.servico';

// Dados do modulo Temperatura, compartilhados entre as abas Resumo e Graficos:
// cada mudanca de filtro faz uma busca so, e a busca anterior e cancelada.
@Injectable({ providedIn: 'root' })
export class TemperaturaDados {
  private readonly filtros = inject(FiltrosServico);
  private readonly leituras = inject(LeiturasServico);
  private readonly tempoReal = inject(TempoRealServico);

  readonly totais = signal<Totais | null>(null);
  readonly serie = signal<PontoSerie[]>([]);
  readonly carregando = signal(false);
  readonly erro = signal(false);

  constructor() {
    // Mudou o filtro (mostra "carregando") ou chegaram leituras novas (atualiza sem piscar)
    merge(
      toObservable(this.filtros.consulta).pipe(map((consulta) => ({ consulta, silencioso: false }))),
      this.tempoReal.avisos$.pipe(
        filter((aviso) => aviso.tipo === 'leituras'),
        map(() => ({ consulta: this.filtros.consulta(), silencioso: true })),
      ),
    )
      .pipe(
        filter((pedido): pedido is { consulta: Consulta; silencioso: boolean } => pedido.consulta !== null),
        tap(({ silencioso }) => {
          if (silencioso) return;
          this.carregando.set(true);
          this.erro.set(false);
        }),
        switchMap(({ consulta }) =>
          forkJoin({
            totais: this.leituras.totais(consulta),
            serie: this.leituras.serieHoraria(consulta),
          }).pipe(
            catchError(() => {
              this.erro.set(true);
              this.carregando.set(false);
              return EMPTY;
            }),
          ),
        ),
        takeUntilDestroyed(),
      )
      .subscribe(({ totais, serie }) => {
        this.totais.set(totais);
        this.serie.set(serie);
        this.carregando.set(false);
      });
  }
}
