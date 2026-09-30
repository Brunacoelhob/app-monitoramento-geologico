import { DecimalPipe } from '@angular/common';
import { Component, computed, input, output } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

// "termico": o mini-grafico e colorido pela escala termica (frio embaixo, calor em cima).
export type TomCartao = 'neutro' | 'termico';

let proximoId = 0;

// Indicador do painel. O clique abre o modal que explica o numero.
@Component({
  selector: 'app-cartao-kpi',
  imports: [DecimalPipe, MatIconModule],
  templateUrl: './cartao-kpi.html',
  styleUrl: './cartao-kpi.scss',
})
export class CartaoKpi {
  readonly icone = input.required<string>();
  readonly titulo = input.required<string>();
  readonly valor = input<number | null>(null);
  readonly casas = input(0);
  readonly sufixo = input('');
  readonly descricao = input('');
  readonly tom = input<TomCartao>('neutro');
  readonly tendencia = input<number[]>([]);
  readonly carregando = input(false);
  readonly abrir = output<void>();

  protected readonly formato = computed(() => `1.${this.casas()}-${this.casas()}`);
  protected readonly idGradiente = `escala-${proximoId++}`;

  protected readonly idArea = `area-${proximoId}`;

  // Linha do mini-grafico, normalizada para o viewBox 100 x 36.
  protected readonly linha = computed(() => {
    const pontos = this.tendencia();
    if (pontos.length < 2) return null;
    const min = Math.min(...pontos);
    const amplitude = Math.max(...pontos) - min || 1;
    const coordenadas = pontos.map((valor, i) => {
      const x = (i / (pontos.length - 1)) * 100;
      const y = 31 - ((valor - min) / amplitude) * 26;
      return `${x.toFixed(2)} ${y.toFixed(2)}`;
    });
    return `M${coordenadas.join(' L')}`;
  });

  // Area sob a linha (preenchimento em degrade)
  protected readonly area = computed(() => {
    const l = this.linha();
    return l ? `${l} L100 36 L0 36 Z` : null;
  });
}
