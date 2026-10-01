import { Component, inject } from '@angular/core';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatTabsModule } from '@angular/material/tabs';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { CabecalhoPagina } from '../../compartilhado/cabecalho-pagina/cabecalho-pagina';
import { LinhaTempo } from '../../compartilhado/linha-tempo/linha-tempo';
import { SeletorPeriodo } from '../../compartilhado/seletor-periodo/seletor-periodo';
import { EstacoesServico } from '../../core/estacoes.servico';
import { FiltrosSismosServico } from '../../core/filtros-sismos.servico';
import { NivelAlerta, Origem } from '../../core/modelos';
import { SismosDados } from '../../core/sismos-dados.servico';

@Component({
  selector: 'app-modulo-sismos',
  imports: [CabecalhoPagina, LinhaTempo, SeletorPeriodo, MatFormFieldModule, MatSelectModule, MatTabsModule, RouterLink, RouterLinkActive, RouterOutlet],
  templateUrl: './modulo-sismos.html',
  styleUrl: './modulo-sismos.scss',
})
export class ModuloSismos {
  protected readonly filtros = inject(FiltrosSismosServico);
  protected readonly estacoes = inject(EstacoesServico);
  protected readonly dados = inject(SismosDados);

  protected readonly abas = [
    { rota: ['/sismos'], rotulo: 'Resumo', exato: true },
    { rota: ['/sismos', 'graficos'], rotulo: 'Gráficos', exato: false },
    { rota: ['/sismos', 'mapa'], rotulo: 'Mapa', exato: false },
    { rota: ['/sismos', 'dados'], rotulo: 'Dados', exato: false },
  ];

  protected readonly magnitudes = [
    { valor: null, rotulo: 'Todas as magnitudes' },
    { valor: 4.5, rotulo: 'M4,5 ou mais' },
    { valor: 5, rotulo: 'M5,0 ou mais' },
    { valor: 5.5, rotulo: 'M5,5 ou mais' },
    { valor: 6, rotulo: 'M6,0 ou mais' },
    { valor: 6.5, rotulo: 'M6,5 ou mais' },
  ];

  constructor() {
    this.filtros.inicializar();
    this.estacoes.carregar().subscribe({ error: () => undefined });
  }

  protected mudarMagnitude(v: number | null) { this.filtros.magnitudeMin.set(v); }
  protected mudarNivel(v: NivelAlerta | null) { this.filtros.nivel.set(v); }
  protected mudarOrigem(v: Origem | null) { this.filtros.origem.set(v); }
  protected mudarEstacao(v: number | null) { this.filtros.estacaoId.set(v); }
}
