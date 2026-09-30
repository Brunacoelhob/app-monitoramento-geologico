import { Component, inject } from '@angular/core';
import { MapaSismos } from '../../../compartilhado/mapa-sismos/mapa-sismos';
import { EstacoesServico } from '../../../core/estacoes.servico';
import { SismosDados } from '../../../core/sismos-dados.servico';

@Component({
  selector: 'app-sismos-mapa',
  imports: [MapaSismos],
  template: `
    <app-mapa-sismos [pontos]="dados.pontos()" [estacoes]="estacoes.estacoes()" altura="36rem" />
    @if (dados.pontos().length === 0 && !dados.carregando()) {
      <p class="vazio">Nenhum sismo neste período. Escolha outras datas no calendário.</p>
    }
  `,
  styles: '.vazio { color: var(--texto-2); }',
})
export class Mapa {
  protected readonly dados = inject(SismosDados);
  protected readonly estacoes = inject(EstacoesServico);
}
