import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';

export interface DadosConfirmacao {
  titulo: string;
  mensagem: string;
  confirmar: string;
}

// Confirmacao simples: fecha com true (confirmou) ou false/undefined (cancelou).
@Component({
  selector: 'app-confirmar-dialog',
  imports: [MatButtonModule, MatDialogModule],
  template: `
    <h2 mat-dialog-title>{{ dados.titulo }}</h2>
    <mat-dialog-content>{{ dados.mensagem }}</mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Cancelar</button>
      <button mat-flat-button [mat-dialog-close]="true">{{ dados.confirmar }}</button>
    </mat-dialog-actions>
  `,
})
export class ConfirmarDialog {
  protected readonly dados = inject<DadosConfirmacao>(MAT_DIALOG_DATA);
}
