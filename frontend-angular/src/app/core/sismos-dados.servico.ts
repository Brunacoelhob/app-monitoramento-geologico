import { Injectable, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { EMPTY, catchError, filter, forkJoin, switchMap, tap } from 'rxjs';
import { FiltrosSismosServico } from './filtros-sismos.servico';
import { DiaSismos, FiltrosSismos, PontoMapa, Regiao, TotaisSismos } from './modelos';
import { diasAntes, hoje, paraDataApi } from './filtros.servico';
import { SismosServico } from './sismos.servico';

// Dados do modulo Sismos, compartilhados entre Resumo, Graficos e Mapa:
// cada mudanca de filtro faz uma busca so (a anterior e cancelada).
@Injectable({ providedIn: 'root' })
export class SismosDados {
  private readonly filtros = inject(FiltrosSismosServico);
  private readonly sismos = inject(SismosServico);

  readonly totais = signal<TotaisSismos | null>(null);
  readonly serieDiaria = signal<DiaSismos[]>([]);
  readonly pontos = signal<PontoMapa[]>([]);
  readonly regioes = signal<Regiao[]>([]);
  // Visao geral dos ultimos 120 dias (nao muda com o periodo escolhido): base da linha do tempo
  readonly serieGeral = signal<DiaSismos[]>([]);
  readonly carregando = signal(false);
  readonly erro = signal(false);

  constructor() {
    toObservable(this.filtros.consulta)
      .pipe(
        filter((consulta): consulta is FiltrosSismos => consulta !== null),
        tap(() => {
          this.carregando.set(true);
          this.erro.set(false);
        }),
        switchMap((consulta) =>
          forkJoin({
            totais: this.sismos.totais(consulta),
            serie: this.sismos.serieDiaria(consulta),
            pontos: this.sismos.mapa(consulta),
            regioes: this.sismos.regioes(consulta),
            geral: this.sismos.serieDiaria({ ...consulta, inicio: paraDataApi(diasAntes(hoje(), 120)), fim: paraDataApi(hoje()) }),
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
      .subscribe(({ totais, serie, pontos, regioes, geral }) => {
        this.totais.set(totais);
        this.serieDiaria.set(serie);
        this.pontos.set(pontos);
        this.regioes.set(regioes.regioes);
        this.serieGeral.set(geral);
        this.carregando.set(false);
      });
  }
}
