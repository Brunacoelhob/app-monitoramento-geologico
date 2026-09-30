import { Component, inject } from '@angular/core';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatTabsModule } from '@angular/material/tabs';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { BarraFiltros } from '../../compartilhado/barra-filtros/barra-filtros';
import { CabecalhoPagina } from '../../compartilhado/cabecalho-pagina/cabecalho-pagina';
import { EstacoesServico } from '../../core/estacoes.servico';
import { FiltrosServico } from '../../core/filtros.servico';
import { Origem } from '../../core/modelos';

// Moldura do modulo: hero, filtros e as abas Resumo, Graficos e Dados.
@Component({
  selector: 'app-modulo-temperatura',
  imports: [CabecalhoPagina, BarraFiltros, MatFormFieldModule, MatSelectModule, MatTabsModule, RouterLink, RouterLinkActive, RouterOutlet],
  templateUrl: './modulo-temperatura.html',
  styleUrl: './modulo-temperatura.scss',
})
export class ModuloTemperatura {
  protected readonly filtros = inject(FiltrosServico);
  protected readonly estacoes = inject(EstacoesServico);

  protected readonly abas = [
    { rota: ['/temperatura'], rotulo: 'Resumo', exato: true },
    { rota: ['/temperatura', 'graficos'], rotulo: 'Gráficos', exato: false },
    { rota: ['/temperatura', 'dados'], rotulo: 'Dados', exato: false },
  ];

  constructor() {
    this.filtros.inicializar();
    this.estacoes.carregar().subscribe({ error: () => undefined });
  }

  protected mudarOrigem(valor: Origem | null) {
    this.filtros.definirOrigem(valor);
  }

  protected mudarEstacao(valor: number | null) {
    this.filtros.definirEstacao(valor);
  }
}
