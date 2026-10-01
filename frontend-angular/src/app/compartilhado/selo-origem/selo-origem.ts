import { Component, computed, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { Origem } from '../../core/modelos';

// Marca de origem do dado. "Simulado" sempre aparece (RN-06), com icone e texto:
// nao depende so da cor.
@Component({
  selector: 'app-selo-origem',
  imports: [MatIconModule],
  template: `
    <span class="selo" [class.simulado]="origem() === 'SIMULADO'">
      <mat-icon aria-hidden="true">{{ origem() === 'SIMULADO' ? 'science' : 'verified' }}</mat-icon>
      {{ rotulo() }}
    </span>
  `,
  styles: `
    .selo {
      display: inline-flex;
      align-items: center;
      gap: 0.25rem;
      padding: 0.15rem 0.65rem 0.15rem 0.4rem;
      border-radius: 999px;
      background: var(--superficie-2);
      font-size: 0.8125rem;
      font-weight: 700;
      white-space: nowrap;
      color: var(--texto-2);
    }
    .selo.simulado {
      background: color-mix(in srgb, var(--acento) 14%, transparent);
      color: color-mix(in srgb, var(--acento) 62%, var(--texto));
    }
    mat-icon {
      font-size: 1.05rem;
      width: 1.05rem;
      height: 1.05rem;
    }
  `,
})
export class SeloOrigem {
  readonly origem = input.required<Origem>();
  protected readonly rotulo = computed(() => (this.origem() === 'SIMULADO' ? 'Simulado' : 'Real'));
}
