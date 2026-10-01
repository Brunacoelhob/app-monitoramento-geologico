import { Component, computed, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { NivelAlerta } from '../../core/modelos';

type Nivel = NivelAlerta | 'REGISTRO';

const DADOS: Record<Nivel, { rotulo: string; icone: string }> = {
  REGISTRO: { rotulo: 'Registro', icone: 'info' },
  ATENCAO: { rotulo: 'Atenção', icone: 'warning' },
  ALTO: { rotulo: 'Alto', icone: 'report' },
  CRITICO: { rotulo: 'Crítico', icone: 'dangerous' },
};

// Nivel do alerta em pilula: a cor sempre vem junto de um icone de forma propria e do texto
// (quem nao distingue cores le o texto e ve a forma).
@Component({
  selector: 'app-selo-nivel',
  imports: [MatIconModule],
  template: `
    <span class="selo" [attr.data-nivel]="nivel()">
      <mat-icon aria-hidden="true">{{ dados().icone }}</mat-icon>
      {{ dados().rotulo }}
    </span>
  `,
  styles: `
    .selo {
      --cor: var(--texto-2);
      display: inline-flex;
      align-items: center;
      gap: 0.25rem;
      padding: 0.15rem 0.65rem 0.15rem 0.4rem;
      border-radius: 999px;
      background: color-mix(in srgb, var(--cor) 14%, transparent);
      // Texto mais escuro (ou mais claro, no tema escuro) que o fundo translucido: contraste minimo 4,5:1
      color: color-mix(in srgb, var(--cor) 62%, var(--texto));
      font-weight: 800;
      font-size: 0.8125rem;
      white-space: nowrap;
    }
    .selo[data-nivel='ATENCAO'] { --cor: var(--sev-atencao); }
    .selo[data-nivel='ALTO'] { --cor: var(--sev-alto); }
    .selo[data-nivel='CRITICO'] { --cor: var(--sev-critico); }
    mat-icon {
      font-size: 1.1rem;
      width: 1.1rem;
      height: 1.1rem;
    }
  `,
})
export class SeloNivel {
  readonly nivel = input.required<Nivel>();
  protected readonly dados = computed(() => DADOS[this.nivel()]);
}
