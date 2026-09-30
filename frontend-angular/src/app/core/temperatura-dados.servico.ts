import { Injectable, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { EMPTY, catchError, filter, forkJoin, switchMap, tap } from 'rxjs';
import { FiltrosServico } from './filtros.servico';
import { LeiturasServico } from './leituras.servico';
import { Consulta, PontoSerie, Totais } from './modelos';

// Dados do modulo Temperatura, compartilhados entre as abas Resumo e Graficos:
// cada mudanca de filtro faz uma busca so, e a busca anterior e cancelada.
@Injectable({ providedIn: 'root' })
export class TemperaturaDados {
  private readonly filtros = inject(FiltrosServico);
  private readonly leituras = inject(LeiturasServico);

  readonly totais = signal<Totais | null>(null);
  readonly serie = signal<PontoSerie[]>([]);
  readonly carregando = signal(false);
  readonly erro = signal(false);

  constructor() {
    toObservable(this.filtros.consulta)
      .pipe(
        filter((consulta): consulta is Consulta => consulta !== null),
        tap(() => {
          this.carregando.set(true);
          this.erro.set(false);
        }),
        switchMap((consulta) =>
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
