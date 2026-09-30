import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';

export interface DadosPrevia {
  url: string;
  nome: string;
}

// Visualizacao ampliada de uma imagem do acervo.
@Component({
  selector: 'app-previa-imagem-dialog',
  imports: [MatButtonModule, MatDialogModule, MatIconModule],
  template: `
    <div class="cabecalho">
      <h2 mat-dialog-title>{{ dados.nome }}</h2>
      <button mat-icon-button mat-dialog-close aria-label="Fechar"><mat-icon>close</mat-icon></button>
    </div>
    <mat-dialog-content>
      <img [src]="dados.url" [alt]="dados.nome" />
    </mat-dialog-content>
  `,
  styles: `
    .cabecalho {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding-right: 8px;
    }
    h2 {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    img {
      display: block;
      max-width: 100%;
      max-height: 70vh;
      margin: 0 auto;
      border-radius: 12px;
    }
  `,
})
export class PreviaImagemDialog {
  protected readonly dados = inject<DadosPrevia>(MAT_DIALOG_DATA);
}
