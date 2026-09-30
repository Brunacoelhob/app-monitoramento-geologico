import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTableModule } from '@angular/material/table';
import { RouterLink } from '@angular/router';
import { EMPTY, catchError, filter, switchMap, tap } from 'rxjs';
import { BotaoRelatorio } from '../../../compartilhado/botao-relatorio/botao-relatorio';
import { SeloNivel } from '../../../compartilhado/selo-nivel/selo-nivel';
import { SeloOrigem } from '../../../compartilhado/selo-origem/selo-origem';
import { FiltrosSismosServico } from '../../../core/filtros-sismos.servico';
import { EventoSismico, FiltrosSismos } from '../../../core/modelos';
import { FUSO_JAPAO, nivelDe } from '../../../core/nivel';
import { SismosServico } from '../../../core/sismos.servico';

interface Parametros {
  consulta: FiltrosSismos;
  pagina: number;
  limite: number;
}

@Component({
  selector: 'app-sismos-dados',
  imports: [DatePipe, DecimalPipe, MatPaginatorModule, MatProgressBarModule, MatTableModule, RouterLink, BotaoRelatorio, SeloNivel, SeloOrigem],
  templateUrl: './dados.html',
  styleUrl: './dados.scss',
})
export class Dados {
  protected readonly filtros = inject(FiltrosSismosServico);
  private readonly sismos = inject(SismosServico);

  protected readonly colunas = ['ocorridoEm', 'magnitude', 'profundidadeKm', 'local', 'origem', 'alerta'];
  protected readonly itens = signal<EventoSismico[]>([]);
  protected readonly total = signal(0);
  protected readonly carregando = signal(false);
  protected readonly erro = signal(false);
  protected readonly fuso = FUSO_JAPAO;
  protected readonly nivelDe = nivelDe;

  protected readonly indicePagina = signal(0);
  protected readonly tamanhoPagina = signal(25);

  private readonly parametros = computed<Parametros | null>(() => {
    const consulta = this.filtros.consulta();
    return consulta ? { consulta, pagina: this.indicePagina() + 1, limite: this.tamanhoPagina() } : null;
  });

  constructor() {
    // Mudou o filtro: volta para a primeira pagina.
    effect(() => {
      this.filtros.consulta();
      untracked(() => this.indicePagina.set(0));
    });

    toObservable(this.parametros)
      .pipe(
        filter((p): p is Parametros => p !== null),
        tap(() => {
          this.carregando.set(true);
          this.erro.set(false);
        }),
        switchMap(({ consulta, pagina, limite }) =>
          this.sismos.eventos(consulta, pagina, limite).pipe(
            catchError(() => {
              this.erro.set(true);
              this.carregando.set(false);
              return EMPTY;
            }),
          ),
        ),
        takeUntilDestroyed(),
      )
      .subscribe((r) => {
        this.itens.set(r.itens);
        this.total.set(r.total);
        this.carregando.set(false);
      });
  }

  protected mudouPagina(e: PageEvent) {
    this.tamanhoPagina.set(e.pageSize);
    this.indicePagina.set(e.pageIndex);
  }
}
