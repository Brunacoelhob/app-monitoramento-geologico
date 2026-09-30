import { Component, inject } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

// Pede o motivo. Alerta ainda ABERTO exige motivo (RN-18); reconhecido, nao.
@Component({
  selector: 'app-encerrar-alerta-dialog',
  imports: [ReactiveFormsModule, MatButtonModule, MatDialogModule, MatFormFieldModule, MatInputModule],
  template: `
    <h2 mat-dialog-title>Encerrar alerta</h2>
    <mat-dialog-content>
      <p>{{ dados.titulo }}</p>
      <mat-form-field appearance="outline" class="cheio">
        <mat-label>Motivo{{ dados.obrigatorio ? '' : ' (opcional)' }}</mat-label>
        <textarea matInput rows="3" maxlength="300" [formControl]="motivo" [required]="dados.obrigatorio"></textarea>
        @if (motivo.hasError('required')) {
          <mat-error>Informe o motivo para encerrar um alerta que ainda não foi reconhecido.</mat-error>
        }
      </mat-form-field>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Cancelar</button>
      <button mat-flat-button (click)="confirmar()">Encerrar alerta</button>
    </mat-dialog-actions>
  `,
  styles: '.cheio { width: min(28rem, 80vw); } p { margin: 0 0 1rem; color: var(--texto-2); }',
})
export class EncerrarAlertaDialog {
  protected readonly dados = inject<{ titulo: string; obrigatorio: boolean }>(MAT_DIALOG_DATA);
  private readonly dialogo = inject(MatDialogRef<EncerrarAlertaDialog, string>);
  protected readonly motivo = new FormControl('', this.dados.obrigatorio ? Validators.required : []);

  protected confirmar() {
    this.motivo.markAsTouched();
    if (this.motivo.invalid) return;
    this.dialogo.close(this.motivo.value?.trim() ?? '');
  }
}
