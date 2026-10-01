import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';

// Texto que explica um grafico para quem nao e da area
export interface ExplicacaoGrafico {
  oQueMostra: string;
  comoLer: string;
  oQueObservar: string;
}

export interface DadosExplicacao extends ExplicacaoGrafico {
  titulo: string;
}

@Component({
  selector: 'app-explicacao-grafico-dialog',
  imports: [MatButtonModule, MatDialogModule, MatIconModule],
  templateUrl: './explicacao-dialog.html',
  styleUrl: './explicacao-dialog.scss',
})
export class ExplicacaoGraficoDialog {
  protected readonly d = inject<DadosExplicacao>(MAT_DIALOG_DATA);
}
