import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { MatCardModule } from '@angular/material/card';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTableModule } from '@angular/material/table';
import { EMPTY, catchError, filter, switchMap, tap } from 'rxjs';
import { BotaoRelatorio } from '../../compartilhado/botao-relatorio/botao-relatorio';
import { SeloOrigem } from '../../compartilhado/selo-origem/selo-origem';
import { FiltrosServico } from '../../core/filtros.servico';
import { LeiturasServico } from '../../core/leituras.servico';
import { Consulta, Leitura } from '../../core/modelos';

interface Parametros {
  consulta: Consulta;
  pagina: number;
  limite: number;
}

@Component({
  selector: 'app-leituras',
  imports: [
    DatePipe,
    DecimalPipe,
    MatCardModule,
    MatPaginatorModule,
    MatProgressBarModule,
    MatTableModule,
    BotaoRelatorio,
    SeloOrigem,
  ],
  templateUrl: './leituras.html',
  styleUrl: './leituras.scss',
})
export class Leituras {
  protected readonly filtros = inject(FiltrosServico);
  private readonly leituras = inject(LeiturasServico);

  protected readonly colunas = ['dataLeitura', 'sala', 'sentido', 'temperatura', 'origem'];
  protected readonly itens = signal<Leitura[]>([]);
  protected readonly total = signal(0);
  protected readonly carregando = signal(false);
  protected readonly erro = signal(false);

  // Paginacao (indice 0 no paginator; a API conta paginas a partir de 1).
  protected readonly indicePagina = signal(0);
  protected readonly tamanhoPagina = signal(50);

  private readonly parametros = computed<Parametros | null>(() => {
    const consulta = this.filtros.consulta();
    if (!consulta) return null;
    return { consulta, pagina: this.indicePagina() + 1, limite: this.tamanhoPagina() };
  });

  constructor() {
    // Mudou o filtro: volta para a primeira pagina.
    effect(() => {
      this.filtros.consulta();
      untracked(() => this.indicePagina.set(0));
    });

    toObservable(this.parametros)
      .pipe(
        filter((parametros): parametros is Parametros => parametros !== null),
        tap(() => {
          this.carregando.set(true);
          this.erro.set(false);
        }),
        switchMap(({ consulta, pagina, limite }) =>
          this.leituras.listar(consulta, pagina, limite).pipe(
            catchError(() => {
              this.erro.set(true);
              this.carregando.set(false);
              return EMPTY;
            }),
          ),
        ),
        takeUntilDestroyed(),
      )
      .subscribe((resposta) => {
        this.itens.set(resposta.itens);
        this.total.set(resposta.total);
        this.carregando.set(false);
      });
  }

  protected mudouPagina(evento: PageEvent): void {
    this.tamanhoPagina.set(evento.pageSize);
    this.indicePagina.set(evento.pageIndex);
  }
}
