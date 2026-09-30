import { Component, computed, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { DatePipe } from '@angular/common';
import { CartaoKpi } from '../../../compartilhado/cartao-kpi/cartao-kpi';
import { EscalaTermica, Marcador } from '../../../compartilhado/escala-termica/escala-termica';
import { FiltrosServico } from '../../../core/filtros.servico';
import { Sentido } from '../../../core/modelos';
import { TemperaturaDados } from '../../../core/temperatura-dados.servico';
import { DetalheKpiDialog, TipoKpi } from './detalhe-kpi-dialog/detalhe-kpi-dialog';

@Component({
  selector: 'app-temperatura-resumo',
  imports: [DatePipe, MatButtonModule, MatIconModule, MatProgressBarModule, CartaoKpi, EscalaTermica],
  templateUrl: './resumo.html',
  styleUrl: './resumo.scss',
})
export class Resumo {
  protected readonly filtros = inject(FiltrosServico);
  protected readonly dados = inject(TemperaturaDados);
  private readonly dialogo = inject(MatDialog);

  protected readonly semLeituras = computed(() => !this.dados.carregando() && this.dados.serie().length === 0);

  // Faixa de temperatura de todo o periodo (maior maxima - menor minima).
  protected readonly amplitude = computed(() => {
    const sentidos = this.dados.totais()?.porSentido ?? [];
    if (sentidos.length === 0) return null;
    return Math.max(...sentidos.map((s) => s.maxima)) - Math.min(...sentidos.map((s) => s.minima));
  });

  // Mini graficos dos cartoes: media e variacao por dia, calculadas da serie horaria.
  private readonly porDia = computed(() => {
    const dias = new Map<string, number[]>();
    for (const ponto of this.dados.serie()) {
      const dia = ponto.hora.slice(0, 10);
      dias.set(dia, [...(dias.get(dia) ?? []), ponto.temperaturaMedia]);
    }
    return [...dias.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, valores]) => valores);
  });
  protected readonly tendenciaMedia = computed(() => this.porDia().map((v) => v.reduce((soma, x) => soma + x, 0) / v.length));
  protected readonly tendenciaAmplitude = computed(() => this.porDia().map((v) => Math.max(...v) - Math.min(...v)));

  // Escala termica: media de cada sentido entre a menor e a maior temperatura.
  protected readonly escala = computed(() => {
    // Interno primeiro, externo depois (a API devolve em ordem alfabetica)
    const sentidos = [...(this.dados.totais()?.porSentido ?? [])].sort((a, b) => b.sentido.localeCompare(a.sentido));
    if (sentidos.length === 0) return null;
    const rotulos: Record<Sentido, string> = { INTERNO: 'Interno', EXTERNO: 'Externo' };
    const marcadores: Marcador[] = sentidos.map((s) => ({ rotulo: rotulos[s.sentido], valor: s.media, sentido: s.sentido }));
    return {
      minimo: Math.floor(Math.min(...sentidos.map((s) => s.minima))),
      maximo: Math.ceil(Math.max(...sentidos.map((s) => s.maxima))),
      marcadores,
    };
  });

  protected abrirDetalhe(tipo: TipoKpi): void {
    const consulta = this.filtros.consulta();
    const totais = this.dados.totais();
    if (!consulta || !totais) return;
    this.dialogo.open(DetalheKpiDialog, {
      data: { tipo, totais, inicio: consulta.inicio, fim: consulta.fim },
      maxWidth: '92vw',
      autoFocus: 'dialog',
    });
  }
}
