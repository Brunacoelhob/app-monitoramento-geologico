import { Component, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';

// Mostra a chave de API uma unica vez: depois disso so existe o hash no servidor.
@Component({
  selector: 'app-chave-dialog',
  imports: [MatButtonModule, MatDialogModule, MatIconModule],
  template: `
    <h2 mat-dialog-title>Chave de API da estação {{ dados.nome }}</h2>
    <mat-dialog-content>
      <p>Guarde esta chave agora. Ela <strong>não será mostrada de novo</strong>. Os sensores a enviam no cabeçalho <code>x-chave-estacao</code>.</p>
      <div class="caixa">
        <code class="chave">{{ dados.chave }}</code>
        <button mat-stroked-button type="button" (click)="copiar()">
          <mat-icon aria-hidden="true">{{ copiada() ? 'check' : 'content_copy' }}</mat-icon>
          {{ copiada() ? 'Copiada' : 'Copiar' }}
        </button>
      </div>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-flat-button mat-dialog-close>Já guardei a chave</button>
    </mat-dialog-actions>
  `,
  styles: `
    .caixa { display: flex; flex-wrap: wrap; align-items: center; gap: 0.75rem; padding: 0.75rem; border: 1px solid var(--borda); border-radius: var(--raio); background: var(--superficie-2); }
    .chave { flex: 1; min-width: 12rem; overflow-wrap: anywhere; font-size: 0.875rem; }
    p { max-width: 52ch; }
  `,
})
export class ChaveDialog {
  protected readonly dados = inject<{ nome: string; chave: string }>(MAT_DIALOG_DATA);
  protected readonly copiada = signal(false);

  protected copiar() {
    navigator.clipboard?.writeText(this.dados.chave).then(() => this.copiada.set(true));
  }
}
