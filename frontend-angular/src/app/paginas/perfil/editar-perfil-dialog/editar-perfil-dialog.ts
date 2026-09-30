import { Component, computed, DestroyRef, ElementRef, inject, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar } from '@angular/material/snack-bar';
import { HttpErrorResponse } from '@angular/common/http';
import { distinctUntilChanged, filter, map, switchMap, tap } from 'rxjs';
import { formatarCelular, formatarCep, formatarCpf, Mascara, soDigitos } from '../../../compartilhado/mascara.diretiva';
import { validarCelular, validarCep, validarCpf } from '../../../compartilhado/validadores';
import { PerfilServico } from '../../../core/perfil.servico';
import { ViaCepServico } from '../../../core/viacep.servico';

export const UFS = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA',
  'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
];

// Modal de edicao dos dados pessoais e do endereco (preenchido pelo ViaCEP).
@Component({
  selector: 'app-editar-perfil-dialog',
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatSelectModule,
    Mascara,
  ],
  templateUrl: './editar-perfil-dialog.html',
  styleUrl: './editar-perfil-dialog.scss',
})
export class EditarPerfilDialog {
  private readonly fb = inject(FormBuilder);
  private readonly perfil = inject(PerfilServico);
  private readonly viaCep = inject(ViaCepServico);
  private readonly aviso = inject(MatSnackBar);
  private readonly dialogo = inject(MatDialogRef<EditarPerfilDialog, boolean>);

  protected readonly ufs = UFS;
  private readonly campoNumero = viewChild<ElementRef<HTMLInputElement>>('numero');

  protected readonly salvando = signal(false);
  protected readonly buscandoCep = signal(false);
  // Resultado da ultima busca de CEP, para mostrar a mensagem certa no campo.
  protected readonly erroCep = signal<'nao-encontrado' | 'indisponivel' | null>(null);
  protected readonly erroServidor = signal<string | null>(null);

  protected readonly dicaCep = computed(() => {
    switch (this.erroCep()) {
      case 'nao-encontrado':
        return 'CEP não encontrado. Preencha à mão.';
      case 'indisponivel':
        return 'Consulta indisponível. Preencha à mão.';
      default:
        return 'Preenche o endereço sozinho.';
    }
  });

  protected readonly formulario = this.fb.nonNullable.group({
    nome: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(100)]],
    cpf: ['', [Validators.required, validarCpf]],
    celular: ['', [Validators.required, validarCelular]],
    cep: ['', [Validators.required, validarCep]],
    logradouro: ['', [Validators.required, Validators.maxLength(150)]],
    numero: ['', [Validators.required, Validators.maxLength(10)]],
    complemento: ['', Validators.maxLength(60)],
    bairro: ['', [Validators.required, Validators.maxLength(80)]],
    cidade: ['', [Validators.required, Validators.maxLength(80)]],
    uf: ['', Validators.required],
  });

  constructor() {
    const atual = this.perfil.perfil();
    if (atual) {
      this.formulario.patchValue({
        nome: atual.nome ?? '',
        cpf: formatarCpf(atual.cpf),
        celular: formatarCelular(atual.celular),
        cep: formatarCep(atual.cep),
        logradouro: atual.logradouro ?? '',
        numero: atual.numero ?? '',
        complemento: atual.complemento ?? '',
        bairro: atual.bairro ?? '',
        cidade: atual.cidade ?? '',
        uf: atual.uf ?? '',
      });
    }

    // Quando o CEP fica completo (8 digitos), consulta o ViaCEP e preenche o endereco.
    // O CEP ja salvo nao e consultado de novo (nao apaga o que o usuario ajustou).
    let ultimoCep = soDigitos(atual?.cep);
    this.formulario.controls.cep.valueChanges
      .pipe(
        map(soDigitos),
        distinctUntilChanged(),
        tap(() => this.erroCep.set(null)),
        filter((cep) => cep.length === 8 && cep !== ultimoCep),
        tap((cep) => {
          ultimoCep = cep;
          this.buscandoCep.set(true);
        }),
        switchMap((cep) => this.viaCep.buscar(cep)),
        takeUntilDestroyed(inject(DestroyRef)),
      )
      .subscribe((resultado) => {
        this.buscandoCep.set(false);
        if (resultado.situacao !== 'ok') {
          this.erroCep.set(resultado.situacao);
          return;
        }
        const { logradouro, bairro, cidade, uf } = resultado.endereco;
        this.formulario.patchValue({ logradouro, bairro, cidade, uf });
        // Vai direto para o numero, que o ViaCEP nao conhece.
        setTimeout(() => this.campoNumero()?.nativeElement.focus());
      });
  }

  protected salvar(): void {
    if (this.formulario.invalid) {
      this.formulario.markAllAsTouched();
      return;
    }

    const valores = this.formulario.getRawValue();
    this.salvando.set(true);
    this.erroServidor.set(null);

    this.perfil
      .atualizar({
        ...valores,
        cpf: soDigitos(valores.cpf),
        celular: soDigitos(valores.celular),
        cep: soDigitos(valores.cep),
      })
      .subscribe({
        next: () => {
          this.aviso.open('Perfil atualizado.', 'Ok', { duration: 4000 });
          this.dialogo.close(true);
        },
        error: (erro: HttpErrorResponse) => {
          this.salvando.set(false);
          if (erro.status === 409) {
            this.formulario.controls.cpf.setErrors({ duplicado: true });
            this.formulario.controls.cpf.markAsTouched();
          } else {
            const mensagem = erro.error?.message;
            this.erroServidor.set(
              Array.isArray(mensagem) ? mensagem.join(' ') : mensagem || 'Não foi possível salvar. Tente novamente.',
            );
          }
        },
      });
  }
}
