import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { Papel } from '../../../core/modelos';
import { UsuariosServico } from '../../../core/usuarios.servico';

// Mesma regra do backend: 10 a 72 caracteres, com letra e numero
const SENHA_FORTE = /^(?=.*[A-Za-z])(?=.*\d).{10,72}$/;

@Component({
  selector: 'app-novo-usuario-dialog',
  imports: [ReactiveFormsModule, MatButtonModule, MatDialogModule, MatFormFieldModule, MatIconModule, MatInputModule, MatProgressSpinnerModule, MatSelectModule],
  templateUrl: './novo-usuario-dialog.html',
  styleUrl: './novo-usuario-dialog.scss',
})
export class NovoUsuarioDialog {
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(UsuariosServico);
  private readonly ref = inject(MatDialogRef<NovoUsuarioDialog>);

  protected readonly salvando = signal(false);
  protected readonly erro = signal<string | null>(null);
  protected readonly mostrarSenha = signal(false);

  protected readonly formulario = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    senha: ['', [Validators.required, Validators.pattern(SENHA_FORTE)]],
    papel: ['VISUALIZADOR' as Papel, Validators.required],
  });

  protected salvar() {
    if (this.formulario.invalid) {
      this.formulario.markAllAsTouched();
      return;
    }
    this.salvando.set(true);
    this.erro.set(null);
    this.api.criar(this.formulario.getRawValue()).subscribe({
      next: () => this.ref.close(true),
      error: (e: HttpErrorResponse) => {
        this.salvando.set(false);
        const m = e.error?.message;
        this.erro.set(Array.isArray(m) ? m.join(' ') : m || 'Não foi possível criar o usuário.');
      },
    });
  }
}
