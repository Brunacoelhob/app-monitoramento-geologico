import { Component, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

// Titulo e descricao das paginas (tudo, menos a Inicio): icone em degrade e titulo grande.
// Sem caixa, sem imagem e sem botao.
@Component({
  selector: 'app-cabecalho-pagina',
  imports: [MatIconModule],
  template: `
    <header class="cabecalho">
      <span class="icone"><mat-icon aria-hidden="true">{{ icone() }}</mat-icon></span>
      <div class="texto">
        <h1>{{ titulo() }}</h1>
        <p>{{ descricao() }}</p>
      </div>
    </header>
  `,
  styles: `
    :host {
      display: block;
    }
    .cabecalho {
      display: flex;
      align-items: center;
      gap: 1.1rem;
      margin-bottom: 1.75rem;
    }
    .icone {
      flex: none;
      display: grid;
      place-items: center;
      width: 3.4rem;
      height: 3.4rem;
      border-radius: 18px;
      color: #fff;
      background: var(--degrade-acento);
      box-shadow: 0 14px 28px -14px color-mix(in srgb, var(--acento) 85%, transparent);
    }
    .icone mat-icon {
      font-size: 1.75rem;
      width: 1.75rem;
      height: 1.75rem;
    }
    h1 {
      margin: 0 0 0.3rem;
      font-size: clamp(1.75rem, 3vw, 2.4rem);
    }
    p {
      margin: 0;
      max-width: 64ch;
      color: var(--texto-2);
      font-size: 1.0625rem;
    }
    @media (max-width: 640px) {
      .icone {
        width: 2.8rem;
        height: 2.8rem;
        border-radius: 15px;
      }
    }
  `,
})
export class CabecalhoPagina {
  readonly titulo = input.required<string>();
  readonly descricao = input.required<string>();
  readonly icone = input('insights');
}
