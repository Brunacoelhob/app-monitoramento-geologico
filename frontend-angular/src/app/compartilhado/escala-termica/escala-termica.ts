import { DecimalPipe } from '@angular/common';
import { Component, computed, effect, input, signal, untracked } from '@angular/core';
import { animarValores } from '../../core/contagem';
import { Sentido } from '../../core/modelos';

export interface Marcador {
  rotulo: string;
  valor: number;
  sentido: Sentido;
}

// A escala termica: uma barra do menor ao maior valor do periodo, com a media
// de cada sentido marcada nela. E o unico movimento "automatico" do painel:
// os valores contam e os marcadores deslizam ate a posicao uma vez.
@Component({
  selector: 'app-escala-termica',
  imports: [DecimalPipe],
  templateUrl: './escala-termica.html',
  styleUrl: './escala-termica.scss',
})
export class EscalaTermica {
  readonly minimo = input.required<number>();
  readonly maximo = input.required<number>();
  readonly marcadores = input.required<Marcador[]>();

  // Doze camadas do frio ao calor (tons de rocha e argila); a altura varia como nos estratos de verdade
  protected readonly estratos = [
    { cor: '#4f86a8', altura: 100 }, { cor: '#6f9bb5', altura: 88 }, { cor: '#8aa9b0', altura: 96 }, { cor: '#a9b39a', altura: 82 },
    { cor: '#c4b98a', altura: 100 }, { cor: '#d3b47a', altura: 90 }, { cor: '#d79f6a', altura: 98 }, { cor: '#d4875a', altura: 84 },
    { cor: '#cc6f4c', altura: 94 }, { cor: '#bf583e', altura: 100 }, { cor: '#a84433', altura: 86 }, { cor: '#8f3a2f', altura: 96 },
  ];

  protected readonly exibidos = signal<number[]>([]);
  private cancelar: () => void = () => undefined;

  protected readonly itens = computed(() =>
    this.marcadores().map((marcador, i) => {
      const valor = this.exibidos()[i] ?? this.minimo();
      const total = this.maximo() - this.minimo() || 1;
      const posicao = Math.min(Math.max((valor - this.minimo()) / total, 0), 1) * 100;
      return { ...marcador, valor, posicao };
    }),
  );

  constructor() {
    effect(() => {
      const alvos = this.marcadores().map((m) => m.valor);
      const inicio = this.minimo();
      untracked(() => {
        this.cancelar();
        const de = this.exibidos().length ? this.exibidos() : alvos.map(() => inicio);
        this.cancelar = animarValores(de, alvos, (valores) => this.exibidos.set(valores));
      });
    });
  }
}
