import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { EstacoesServico, NovaEstacao } from '../../../core/estacoes.servico';
import { ChaveDialog } from '../chave-dialog/chave-dialog';

const SENSORES = [
  { chave: 'sismografo', rotulo: 'Sismógrafo', sensor: { tipo: 'SISMOGRAFO', nome: 'Sismógrafo' } },
  { chave: 'gps', rotulo: 'Receptor GPS', sensor: { tipo: 'GPS', nome: 'Receptor GPS' } },
  { chave: 'interna', rotulo: 'Temperatura interna', sensor: { tipo: 'TEMPERATURA', nome: 'Temperatura interna', sentido: 'INTERNO' } },
  { chave: 'externa', rotulo: 'Temperatura externa', sensor: { tipo: 'TEMPERATURA', nome: 'Temperatura externa', sentido: 'EXTERNO' } },
] as const;

@Component({
  selector: 'app-nova-estacao-dialog',
  imports: [ReactiveFormsModule, MatButtonModule, MatCheckboxModule, MatDialogModule, MatFormFieldModule, MatInputModule, MatProgressSpinnerModule, MatSelectModule],
  templateUrl: './nova-estacao-dialog.html',
  styleUrl: './nova-estacao-dialog.scss',
})
export class NovaEstacaoDialog {
  private readonly fb = inject(FormBuilder);
  private readonly estacoes = inject(EstacoesServico);
  private readonly dialogo = inject(MatDialog);
  private readonly ref = inject(MatDialogRef<NovaEstacaoDialog>);

  protected readonly sensoresDisponiveis = SENSORES;
  protected readonly placas = [
    { valor: 'PACIFICA', rotulo: 'Pacífica' },
    { valor: 'FILIPINAS', rotulo: 'Mar das Filipinas' },
    { valor: 'OKHOTSK', rotulo: 'Okhotsk' },
    { valor: 'AMUR', rotulo: 'Amur' },
  ];
  protected readonly salvando = signal(false);
  protected readonly erro = signal<string | null>(null);

  protected readonly formulario = this.fb.nonNullable.group({
    codigo: ['', [Validators.required, Validators.pattern(/^[A-Z0-9-]{2,30}$/)]],
    nome: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(80)]],
    latitude: [null as number | null, [Validators.required, Validators.min(-90), Validators.max(90)]],
    longitude: [null as number | null, [Validators.required, Validators.min(-180), Validators.max(180)]],
    placa: [''],
    origem: ['REAL' as 'REAL' | 'SIMULADO', Validators.required],
    sismografo: [true],
    gps: [true],
    interna: [true],
    externa: [true],
  });

  protected salvar() {
    const v = this.formulario.getRawValue();
    const sensores = SENSORES.filter((s) => v[s.chave]).map((s) => ({ ...s.sensor }));
    if (this.formulario.invalid || sensores.length === 0) {
      this.formulario.markAllAsTouched();
      if (sensores.length === 0) this.erro.set('Escolha ao menos um sensor.');
      return;
    }

    const dados: NovaEstacao = {
      codigo: v.codigo, nome: v.nome, latitude: v.latitude ?? undefined, longitude: v.longitude ?? undefined,
      placa: v.placa || undefined, origem: v.origem, sensores: sensores as NovaEstacao['sensores'],
    };
    this.salvando.set(true);
    this.erro.set(null);
    this.estacoes.criar(dados).subscribe({
      next: (criada) => {
        this.ref.close(true);
        this.dialogo.open(ChaveDialog, { data: { nome: criada.nome, chave: criada.chave }, maxWidth: '92vw', disableClose: true });
      },
      error: (e: HttpErrorResponse) => {
        this.salvando.set(false);
        const m = e.error?.message;
        this.erro.set(e.status === 409 ? 'Já existe uma estação com este código.' : Array.isArray(m) ? m.join(' ') : m || 'Não foi possível criar a estação.');
      },
    });
  }
}
