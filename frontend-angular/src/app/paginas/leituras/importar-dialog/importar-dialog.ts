import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { formatarTamanho, mensagemDeErro } from '../../../core/arquivo';
import { EstacoesServico } from '../../../core/estacoes.servico';
import { LeiturasServico, ResultadoImportacao } from '../../../core/leituras.servico';

const LIMITE_BYTES = 5 * 1024 * 1024;

// Importa leituras de um arquivo CSV (somente admin). As linhas boas entram; as ruins voltam com a linha e o motivo.
@Component({
  selector: 'app-importar-dialog',
  imports: [MatButtonModule, MatDialogModule, MatFormFieldModule, MatIconModule, MatProgressSpinnerModule, MatSelectModule],
  templateUrl: './importar-dialog.html',
  styleUrl: './importar-dialog.scss',
})
export class ImportarDialog {
  private readonly leituras = inject(LeiturasServico);
  protected readonly estacoes = inject(EstacoesServico);

  protected readonly arquivo = signal<File | null>(null);
  protected readonly estacaoId = signal<number | null>(null);
  protected readonly enviando = signal(false);
  protected readonly arrastando = signal(false);
  protected readonly erro = signal<string | null>(null);
  protected readonly resultado = signal<ResultadoImportacao | null>(null);

  protected readonly tamanho = computed(() => formatarTamanho(this.arquivo()?.size ?? 0));

  constructor() {
    if (this.estacoes.estacoes().length === 0) this.estacoes.carregar().subscribe({ error: () => undefined });
  }

  protected escolher(entrada: HTMLInputElement) {
    this.definirArquivo(entrada.files?.[0] ?? null);
    entrada.value = ''; // permite escolher o mesmo arquivo de novo
  }

  protected soltar(evento: DragEvent) {
    evento.preventDefault();
    this.arrastando.set(false);
    this.definirArquivo(evento.dataTransfer?.files?.[0] ?? null);
  }

  protected sobre(evento: DragEvent, dentro: boolean) {
    evento.preventDefault();
    this.arrastando.set(dentro);
  }

  private definirArquivo(arquivo: File | null) {
    this.resultado.set(null);
    this.erro.set(null);
    if (!arquivo) return;
    if (!/\.(csv|txt)$/i.test(arquivo.name)) return this.erro.set('Escolha um arquivo .csv.');
    if (arquivo.size > LIMITE_BYTES) return this.erro.set(`O arquivo tem ${formatarTamanho(arquivo.size)} e o máximo é 5 MB.`);
    if (arquivo.size === 0) return this.erro.set('O arquivo está vazio.');
    this.arquivo.set(arquivo);
  }

  protected importar() {
    const arquivo = this.arquivo();
    if (!arquivo || this.enviando()) return;
    this.enviando.set(true);
    this.erro.set(null);
    this.leituras.importar(arquivo, this.estacaoId() ?? undefined).subscribe({
      next: (resultado) => {
        this.resultado.set(resultado);
        this.enviando.set(false);
      },
      error: async (e: unknown) => {
        this.enviando.set(false);
        this.erro.set(e instanceof HttpErrorResponse && e.status === 413 ? 'O arquivo passa de 5 MB.' : await mensagemDeErro(e, 'Não foi possível importar o arquivo.'));
      },
    });
  }

  protected novoArquivo() {
    this.arquivo.set(null);
    this.resultado.set(null);
    this.erro.set(null);
  }

  protected baixarModelo() {
    this.leituras.baixarModelo();
  }
}
