import { A11yModule } from '@angular/cdk/a11y';
import { DatePipe } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';
import { AlarmeServico } from '../../core/alarme.servico';
import { FUSO_JAPAO } from '../../core/nivel';

const SIGNIFICADO = {
  ALTO: 'Sismo forte (M5,5 a 6,4). Pode causar danos perto do epicentro.',
  CRITICO: 'Sismo muito forte (M6,5 ou mais). Potencial de danos graves; no mar, pode gerar tsunami.',
} as const;

// Luz vermelha suave nas bordas da tela (pulso lento, menos de 1 Hz) e um aviso que explica o que
// aconteceu e o que verificar. Com "reduzir animacoes" a luz fica parada.
@Component({
  selector: 'app-alarme',
  imports: [A11yModule, DatePipe, MatButtonModule, MatIconModule, RouterLink],
  templateUrl: './alarme.html',
  styleUrl: './alarme.scss',
})
export class Alarme {
  protected readonly alarme = inject(AlarmeServico);
  protected readonly fuso = FUSO_JAPAO;

  protected readonly significado = computed(() => {
    const nivel = this.alarme.atual()?.nivel;
    return nivel === 'ALTO' || nivel === 'CRITICO' ? SIGNIFICADO[nivel] : '';
  });
  protected readonly ehPrevia = computed(() => this.alarme.previa() !== null);
}
