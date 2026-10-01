import { Component, inject, input, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import type { ECharts, EChartsCoreOption } from 'echarts/core';
import { NgxEchartsDirective } from 'ngx-echarts';
import { AcessibilidadeServico } from '../../core/acessibilidade.servico';
import { salvarArquivo } from '../../core/arquivo';
import { ExplicacaoGraficoDialog, type ExplicacaoGrafico } from './explicacao-dialog/explicacao-dialog';

// Grafico com titulo, descricao, botao "Baixar imagem" (PNG) e um espaco para a tabela
// equivalente (acessibilidade: quem nao enxerga o grafico le os mesmos dados).
@Component({
  selector: 'app-grafico',
  imports: [MatButtonModule, MatIconModule, NgxEchartsDirective],
  templateUrl: './grafico.html',
  styleUrl: './grafico.scss',
})
export class Grafico {
  readonly titulo = input.required<string>();
  readonly descricao = input('');
  readonly opcoes = input.required<EChartsCoreOption>();
  readonly altura = input('22rem');
  readonly arquivo = input('grafico');
  readonly explicacao = input<ExplicacaoGrafico | null>(null);

  private readonly a11y = inject(AcessibilidadeServico);
  private readonly dialogo = inject(MatDialog);
  private instancia: ECharts | null = null;
  protected readonly pronto = signal(false);

  protected aoIniciar(instancia: ECharts) {
    this.instancia = instancia;
    this.pronto.set(true);
  }

  protected entender() {
    const e = this.explicacao();
    if (e) this.dialogo.open(ExplicacaoGraficoDialog, { data: { titulo: this.titulo(), ...e }, maxWidth: '92vw', autoFocus: 'dialog' });
  }

  protected baixarImagem() {
    if (!this.instancia) return;
    const url = this.instancia.getDataURL({ type: 'png', pixelRatio: 2, backgroundColor: this.a11y.cores().fundo });
    fetch(url)
      .then((r) => r.blob())
      .then((blob) => salvarArquivo(blob, `${this.arquivo()}.png`));
  }
}
