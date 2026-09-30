import { Component, inject, input, signal } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { mensagemDeErro } from '../../core/arquivo';
import { FormatoRelatorio } from '../../core/modelos';
import { ConsultaRelatorio, ModuloRelatorio, RelatorioServico } from '../../core/relatorio.servico';

const FORMATOS: { formato: FormatoRelatorio; rotulo: string; detalhe: string; icone: string }[] = [
  { formato: 'pdf', rotulo: 'PDF', detalhe: 'Resumo e gráfico', icone: 'picture_as_pdf' },
  { formato: 'xlsx', rotulo: 'Excel', detalhe: 'Resumo, dias e todas as leituras', icone: 'table_view' },
  { formato: 'csv', rotulo: 'CSV', detalhe: 'Todas as leituras, sem formatação', icone: 'description' },
];

// Botao com menu para baixar o relatorio do periodo filtrado (PDF, Excel ou CSV).
@Component({
  selector: 'app-botao-relatorio',
  imports: [MatIconModule, MatMenuModule, MatProgressSpinnerModule],
  templateUrl: './botao-relatorio.html',
  styleUrl: './botao-relatorio.scss',
})
export class BotaoRelatorio {
  readonly consulta = input<ConsultaRelatorio | null>(null);
  readonly modulo = input<ModuloRelatorio>('temperatura');
  readonly variante = input<'destaque' | 'compacto'>('compacto');

  private readonly relatorios = inject(RelatorioServico);
  private readonly aviso = inject(MatSnackBar);

  protected readonly formatos = FORMATOS;
  protected readonly gerando = signal<FormatoRelatorio | null>(null);

  protected baixar(formato: FormatoRelatorio): void {
    const consulta = this.consulta();
    if (!consulta || this.gerando()) return;

    this.gerando.set(formato);
    this.relatorios.baixar(formato, consulta, this.modulo()).subscribe({
      next: () => {
        this.gerando.set(null);
        this.aviso.open(`Relatório ${formato.toUpperCase()} baixado.`, 'Ok', { duration: 4000 });
      },
      error: async (erro: unknown) => {
        this.gerando.set(null);
        const mensagem = await mensagemDeErro(erro, 'Não foi possível baixar o relatório.');
        this.aviso.open(mensagem, 'Fechar', { duration: 7000 });
      },
    });
  }
}
