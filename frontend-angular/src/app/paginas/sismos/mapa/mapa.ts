import { Component, computed, inject } from '@angular/core';
import { MapaSismos } from '../../../compartilhado/mapa-sismos/mapa-sismos';
import { EstacoesServico } from '../../../core/estacoes.servico';
import { FiltrosSismosServico } from '../../../core/filtros-sismos.servico';
import { SismosDados } from '../../../core/sismos-dados.servico';

@Component({
  selector: 'app-sismos-mapa',
  imports: [MapaSismos],
  templateUrl: './mapa.html',
  styleUrl: './mapa.scss',
})
export class Mapa {
  protected readonly dados = inject(SismosDados);
  protected readonly estacoes = inject(EstacoesServico);
  protected readonly filtros = inject(FiltrosSismosServico);

  // Regiao escolhida (null = mundo todo): o cartao de contexto explica onde e como ela se comporta
  protected readonly escolhida = computed(() => this.dados.regioes().find((r) => r.codigo === this.filtros.regiao()) ?? null);
}
