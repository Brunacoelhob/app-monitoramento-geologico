import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { igualA, validarSenhaForte } from '../../../compartilhado/validadores';
import { PerfilServico } from '../../../core/perfil.servico';

@Component({
  selector: 'app-alterar-senha-dialog',
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './alterar-senha-dialog.html',
  styleUrl: './alterar-senha-dialog.scss',
})
export class AlterarSenhaDialog {
  private readonly fb = inject(FormBuilder);
  private readonly perfil = inject(PerfilServico);
  private readonly aviso = inject(MatSnackBar);
  private readonly dialogo = inject(MatDialogRef<AlterarSenhaDialog, boolean>);

  protected readonly mostrar = signal(false);
  protected readonly salvando = signal(false);
  protected readonly erroServidor = signal<string | null>(null);

  protected readonly formulario = this.fb.nonNullable.group({
    senhaAtual: ['', [Validators.required, Validators.maxLength(72)]],
    novaSenha: ['', [Validators.required, Validators.minLength(8), Validators.maxLength(72), validarSenhaForte]],
    confirmacao: ['', [Validators.required, igualA('novaSenha')]],
  });

  constructor() {
    // Mudou a nova senha: a confirmacao precisa ser conferida de novo.
    this.formulario.controls.novaSenha.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.formulario.controls.confirmacao.updateValueAndValidity());
  }

  protected salvar(): void {
    if (this.formulario.invalid) {
      this.formulario.markAllAsTouched();
      return;
    }

    const { senhaAtual, novaSenha } = this.formulario.getRawValue();
    this.salvando.set(true);
    this.erroServidor.set(null);

    this.perfil.alterarSenha(senhaAtual, novaSenha).subscribe({
      next: () => {
        this.aviso.open('Senha alterada com sucesso.', 'Ok', { duration: 4000 });
        this.dialogo.close(true);
      },
      error: (erro: HttpErrorResponse) => {
        this.salvando.set(false);
        if (erro.status === 422) {
          this.formulario.controls.senhaAtual.setErrors({ incorreta: true });
          this.formulario.controls.senhaAtual.markAsTouched();
        } else if (erro.status === 429) {
          this.erroServidor.set('Muitas tentativas. Aguarde um minuto.');
        } else {
          const mensagem = erro.error?.message;
          this.erroServidor.set(
            Array.isArray(mensagem) ? mensagem.join(' ') : mensagem || 'Não foi possível alterar a senha.',
          );
        }
      },
    });
  }
}
