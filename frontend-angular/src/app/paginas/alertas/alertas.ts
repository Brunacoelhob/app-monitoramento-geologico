import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { RouterLink } from '@angular/router';
import { CabecalhoPagina } from '../../compartilhado/cabecalho-pagina/cabecalho-pagina';
import { SeloNivel } from '../../compartilhado/selo-nivel/selo-nivel';
import { AlarmeServico } from '../../core/alarme.servico';
import { AuthServico } from '../../core/auth.servico';
import { AlertaResumo, EstadoAlerta, NivelAlerta } from '../../core/modelos';
import { FUSO_JAPAO } from '../../core/nivel';
import { FiltrosAlertas, SismosServico } from '../../core/sismos.servico';

@Component({
  selector: 'app-alertas',
  imports: [DatePipe, MatButtonModule, MatFormFieldModule, MatPaginatorModule, MatProgressBarModule, MatSelectModule, MatTableModule, RouterLink, CabecalhoPagina, SeloNivel],
  templateUrl: './alertas.html',
  styleUrl: './alertas.scss',
})
export class Alertas {
  private readonly sismos = inject(SismosServico);
  protected readonly alarme = inject(AlarmeServico);
  private readonly auth = inject(AuthServico);
  protected readonly ehAdmin = computed(() => this.auth.usuario()?.papel === 'ADMIN');

  protected readonly colunas = ['nivel', 'titulo', 'tipo', 'estado', 'abertoEm', 'replicas'];
  protected readonly itens = signal<AlertaResumo[]>([]);
  protected readonly total = signal(0);
  protected readonly carregando = signal(false);
  protected readonly erro = signal(false);
  protected readonly fuso = FUSO_JAPAO;

  protected readonly estado = signal<EstadoAlerta | null>('ABERTO');
  protected readonly nivel = signal<NivelAlerta | null>(null);
  protected readonly tipo = signal<'SISMO' | 'SEM_COMUNICACAO' | null>(null);
  protected readonly indicePagina = signal(0);
  protected readonly tamanhoPagina = signal(25);

  protected readonly rotuloEstado: Record<EstadoAlerta, string> = { ABERTO: 'Aberto', RECONHECIDO: 'Reconhecido', ENCERRADO: 'Encerrado' };
  protected readonly rotuloTipo = { SISMO: 'Sismo', SEM_COMUNICACAO: 'Sem comunicação' };

  constructor() {
    this.carregar();
  }

  protected mudarEstado(v: EstadoAlerta | null) { this.estado.set(v); this.recarregar(); }
  protected mudarNivel(v: NivelAlerta | null) { this.nivel.set(v); this.recarregar(); }
  protected mudarTipo(v: 'SISMO' | 'SEM_COMUNICACAO' | null) { this.tipo.set(v); this.recarregar(); }

  private recarregar() {
    this.indicePagina.set(0);
    this.carregar();
  }

  protected rotuloDoTipo(tipo: 'SISMO' | 'SEM_COMUNICACAO') { return this.rotuloTipo[tipo]; }
  protected rotuloDoEstado(estado: EstadoAlerta) { return this.rotuloEstado[estado]; }

  protected mudouPagina(e: PageEvent) {
    this.tamanhoPagina.set(e.pageSize);
    this.indicePagina.set(e.pageIndex);
    this.carregar();
  }

  private carregar() {
    const filtros: FiltrosAlertas = {
      estado: this.estado() ?? undefined,
      nivel: this.nivel() ?? undefined,
      tipo: this.tipo() ?? undefined,
    };
    this.carregando.set(true);
    this.erro.set(false);
    this.sismos.alertas(filtros, this.indicePagina() + 1, this.tamanhoPagina()).subscribe({
      next: (r) => {
        this.itens.set(r.itens);
        this.total.set(r.total);
        this.carregando.set(false);
      },
      error: () => {
        this.erro.set(true);
        this.carregando.set(false);
      },
    });
  }
}
