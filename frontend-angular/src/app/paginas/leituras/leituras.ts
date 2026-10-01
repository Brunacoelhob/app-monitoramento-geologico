import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTableModule } from '@angular/material/table';
import { EMPTY, catchError, filter, map, merge, switchMap, tap } from 'rxjs';
import { BotaoRelatorio } from '../../compartilhado/botao-relatorio/botao-relatorio';
import { SeloOrigem } from '../../compartilhado/selo-origem/selo-origem';
import { AuthServico } from '../../core/auth.servico';
import { FiltrosServico } from '../../core/filtros.servico';
import { LeiturasServico } from '../../core/leituras.servico';
import { Consulta, Leitura } from '../../core/modelos';
import { ImportarDialog } from './importar-dialog/importar-dialog';
import { TempoRealServico } from '../../core/tempo-real.servico';

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
    MatButtonModule,
    MatCardModule,
    MatIconModule,
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
  private readonly tempoReal = inject(TempoRealServico);
  private readonly dialogo = inject(MatDialog);
  private readonly aviso = inject(MatSnackBar);
  private readonly auth = inject(AuthServico);
  protected readonly ehAdmin = computed(() => this.auth.usuario()?.papel === 'ADMIN');

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

    // Mudou filtro ou pagina (mostra "carregando") ou chegaram leituras novas (atualiza sem piscar)
    merge(
      toObservable(this.parametros).pipe(map((parametros) => ({ parametros, silencioso: false }))),
      this.tempoReal.avisos$.pipe(
        filter((aviso) => aviso.tipo === 'leituras'),
        map(() => ({ parametros: this.parametros(), silencioso: true })),
      ),
    )
      .pipe(
        filter((pedido): pedido is { parametros: Parametros; silencioso: boolean } => pedido.parametros !== null),
        tap(({ silencioso }) => {
          if (silencioso) return;
          this.carregando.set(true);
          this.erro.set(false);
        }),
        switchMap(({ parametros: { consulta, pagina, limite } }) =>
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

  protected importar(): void {
    this.dialogo
      .open(ImportarDialog, { maxWidth: '92vw', autoFocus: 'dialog' })
      .afterClosed()
      .subscribe((concluiu) => {
        if (concluiu) this.aviso.open('Importação concluída. Os painéis se atualizam sozinhos.', 'Fechar', { duration: 5000 });
      });
  }

  protected mudouPagina(evento: PageEvent): void {
    this.tamanhoPagina.set(evento.pageSize);
    this.indicePagina.set(evento.pageIndex);
  }
}
