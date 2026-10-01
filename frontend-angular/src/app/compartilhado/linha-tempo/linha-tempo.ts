import { DatePipe } from '@angular/common';
import { Component, computed, inject, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import type { ECharts, EChartsCoreOption } from 'echarts/core';
import { NgxEchartsDirective } from 'ngx-echarts';
import { AcessibilidadeServico } from '../../core/acessibilidade.servico';
import { diasAntes, hoje } from '../../core/filtros.servico';
import { DiaSismos } from '../../core/modelos';
import { provedorGraficos } from '../grafico/echarts-config';
import { baseGrafico, degrade } from '../grafico/estilo-grafico';

const DIA_MS = 86_400_000;
const ATALHOS = [7, 30, 90];

export interface PeriodoEscolhido {
  inicio: Date;
  fim: Date;
}

// Converte "AAAA-MM-DD" em meia-noite local (os filtros tambem usam datas locais)
const meiaNoite = (dia: string) => {
  const [a, m, d] = dia.split('-').map(Number);
  return new Date(a, m - 1, d);
};
const inicioDoDia = (t: number) => {
  const d = new Date(t);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
};

// Linha do tempo dos ultimos meses: arrastar o mouse sobre ela escolhe o periodo do filtro.
// O calendario e os atalhos (7, 30 e 90 dias) continuam servindo a quem usa so o teclado.
@Component({
  selector: 'app-linha-tempo',
  imports: [DatePipe, MatButtonModule, NgxEchartsDirective],
  providers: [provedorGraficos()],
  templateUrl: './linha-tempo.html',
  styleUrl: './linha-tempo.scss',
})
export class LinhaTempo {
  readonly serie = input.required<DiaSismos[]>();
  readonly inicio = input<Date | null>(null);
  readonly fim = input<Date | null>(null);
  readonly selecionado = output<PeriodoEscolhido>();

  private readonly a11y = inject(AcessibilidadeServico);
  private instancia: ECharts | null = null;

  protected readonly atalhos = ATALHOS;

  // Atalho "ativo" quando o periodo atual termina hoje e tem exatamente N dias
  protected readonly atalhoAtivo = computed(() => {
    const i = this.inicio();
    const f = this.fim();
    if (!i || !f || f.getTime() !== hoje().getTime()) return null;
    const dias = Math.round((f.getTime() - i.getTime()) / DIA_MS);
    return ATALHOS.includes(dias) ? dias : null;
  });

  protected readonly resumo = computed(() => {
    const total = this.serie().reduce((soma, d) => soma + d.eventos, 0);
    return `Linha do tempo dos sismos por dia, com ${total} sismos no total. Arraste sobre ela para escolher o período, ou use os botões de 7, 30 e 90 dias.`;
  });

  // Barras dos ultimos 120 dias (so a forma geral: a parte fixa do grafico)
  protected readonly opcoes = computed<EChartsCoreOption>(() => {
    const c = this.a11y.cores();
    const base = baseGrafico(c, this.a11y.reduzirMovimento());
    return {
      ...base,
      useUTC: false,
      tooltip: {
        ...base.tooltip,
        trigger: 'axis',
        formatter: (p: { value: [number, number] }[]) => {
          const [t, n] = p[0].value;
          return `${new Date(t).toLocaleDateString('pt-BR')}<br/><strong>${n}</strong> ${n === 1 ? 'sismo' : 'sismos'}`;
        },
      },
      toolbox: { show: false }, // o brush cria uma barra de ferramentas propria; aqui o arraste e ligado por codigo
      grid: { left: 8, right: 8, top: 8, bottom: 22 },
      xAxis: {
        type: 'time',
        axisLine: { lineStyle: { color: c.linha } },
        axisTick: { show: false },
        axisLabel: { color: c.textoSecundario, hideOverlap: true },
        splitLine: { show: false },
      },
      yAxis: { type: 'value', show: false },
      brush: {
        xAxisIndex: 0,
        brushType: 'lineX',
        brushMode: 'single',
        toolbox: [], // sem a barra de ferramentas padrao: o arraste e ligado por codigo
        transformable: false,
        removeOnClick: false,
        brushStyle: { color: 'rgba(59, 91, 219, 0.18)', borderColor: c.acento, borderWidth: 1 },
      },
      series: [
        {
          type: 'bar',
          barMaxWidth: 6,
          itemStyle: { color: degrade(c.acento, 0.9, 0.35), borderRadius: [3, 3, 0, 0] },
          data: this.serie().map((d) => [meiaNoite(d.dia).getTime(), d.eventos]),
          // Sombra sobre o periodo escolhido (do primeiro ao ultimo dia, inclusive)
          markArea: this.inicio() && this.fim()
            ? { silent: true, itemStyle: { color: c.acento, opacity: 0.16 }, data: [[{ xAxis: this.inicio()!.getTime() }, { xAxis: this.fim()!.getTime() + DIA_MS }]] }
            : undefined,
        },
      ],
    };
  });

  protected aoIniciar(grafico: ECharts) {
    this.instancia = grafico;
    // O componente de selecao so existe depois do primeiro desenho: liga o arraste nesse momento
    // (e de novo a cada redesenho, porque atualizar o grafico reinicia o modo de selecao)
    grafico.on('finished', () => this.ativarArraste());
    grafico.on('brushEnd', (evento: unknown) => {
      const area = (evento as { areas?: { coordRange?: [number, number] }[] }).areas?.[0]?.coordRange;
      // Limpa o retangulo: o destaque do periodo passa a mostrar a escolha
      grafico.dispatchAction({ type: 'brush', areas: [] });
      this.ativarArraste();
      if (!area) return;

      const limite = hoje();
      const inicio = inicioDoDia(Math.min(area[0], area[1]));
      const fim = inicioDoDia(Math.max(area[0], area[1]));
      this.selecionado.emit({ inicio, fim: fim > limite ? limite : fim });
    });
  }

  // Deixa o arraste ligado desde o inicio (sem precisar clicar em uma ferramenta)
  private ativarArraste() {
    this.instancia?.dispatchAction({
      type: 'takeGlobalCursor',
      key: 'brush',
      brushOption: { brushType: 'lineX', brushMode: 'single' },
    });
  }

  protected escolherAtalho(dias: number) {
    const fim = hoje();
    this.selecionado.emit({ inicio: diasAntes(fim, dias), fim });
  }
}
