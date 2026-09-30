import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';

export interface LinhaInfo {
  rotulo: string;
  texto: string;
  proporcao?: number; // 0 a 1: largura da barra
  cor?: string;
}

export interface DadosInfoKpi {
  titulo: string;
  icone: string;
  destaque: string;
  unidade: string;
  periodo?: string;
  oQueE: string;
  comoCalcula: string;
  tituloLinhas?: string;
  linhas?: LinhaInfo[];
  dica?: string;
}

// Modal informativo de um indicador: o que e, como e calculado e o detalhe.
@Component({
  selector: 'app-info-kpi-dialog',
  imports: [MatButtonModule, MatDialogModule, MatIconModule],
  templateUrl: './info-kpi-dialog.html',
  styleUrl: './info-kpi-dialog.scss',
})
export class InfoKpiDialog {
  protected readonly c = inject<DadosInfoKpi>(MAT_DIALOG_DATA);
}
