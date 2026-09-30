import { Component, computed, inject } from '@angular/core';
import type { EChartsCoreOption } from 'echarts/core';
import { BotaoRelatorio } from '../../../compartilhado/botao-relatorio/botao-relatorio';
import { provedorGraficos } from '../../../compartilhado/grafico/echarts-config';
import { Grafico } from '../../../compartilhado/grafico/grafico';
import { AcessibilidadeServico } from '../../../core/acessibilidade.servico';
import { FiltrosSismosServico } from '../../../core/filtros-sismos.servico';
import { dataJst, nivelDe } from '../../../core/nivel';
import { SismosDados } from '../../../core/sismos-dados.servico';

// Forma diferente por nivel, alem da cor (quem nao distingue cores ve a forma)
const SIMBOLO = { REGISTRO: 'circle', ATENCAO: 'triangle', ALTO: 'diamond', CRITICO: 'rect' } as const;

@Component({
  selector: 'app-sismos-graficos',
  imports: [BotaoRelatorio, Grafico],
  providers: [provedorGraficos()],
  templateUrl: './graficos.html',
  styleUrl: './graficos.scss',
})
export class Graficos {
  protected readonly filtros = inject(FiltrosSismosServico);
  protected readonly dados = inject(SismosDados);
  private readonly a11y = inject(AcessibilidadeServico);

  protected readonly semDados = computed(() => !this.dados.carregando() && this.dados.pontos().length === 0);
  protected readonly dia = (iso: string) => iso.split('-').reverse().join('/');

  private eixos() {
    const c = this.a11y.cores();
    const estilo = { axisLabel: { color: c.textoSecundario }, axisLine: { lineStyle: { color: c.linha } } };
    return { c, estilo, grade: { lineStyle: { color: c.linha } } };
  }

  // Sismos por dia (barras) e maior magnitude do dia (linha)
  protected readonly opcoesPorDia = computed<EChartsCoreOption>(() => {
    const { c, estilo, grade } = this.eixos();
    const serie = this.dados.serieDiaria();
    return {
      backgroundColor: 'transparent',
      textStyle: { color: c.textoSecundario },
      tooltip: { trigger: 'axis' },
      legend: { top: 0, textStyle: { color: c.textoSecundario } },
      grid: { left: 52, right: 56, top: 44, bottom: 60 },
      dataZoom: [{ type: 'inside' }, { type: 'slider', height: 20, bottom: 8 }],
      xAxis: { type: 'category', data: serie.map((d) => this.dia(d.dia)), ...estilo },
      yAxis: [
        { type: 'value', name: 'Sismos', minInterval: 1, nameTextStyle: { color: c.textoSecundario }, ...estilo, splitLine: grade },
        { type: 'value', name: 'Magnitude', min: 4, nameTextStyle: { color: c.textoSecundario }, ...estilo, splitLine: { show: false } },
      ],
      series: [
        { name: 'Sismos por dia', type: 'bar', itemStyle: { color: c.acento }, data: serie.map((d) => d.eventos) },
        { name: 'Maior magnitude do dia', type: 'line', yAxisIndex: 1, symbol: 'diamond', symbolSize: 8, lineStyle: { type: 'dashed', width: 2, color: c.texto }, itemStyle: { color: c.texto }, data: serie.map((d) => d.maiorMagnitude) },
      ],
    };
  });

  // Cada sismo: quando aconteceu x magnitude (forma e cor pelo nivel)
  protected readonly opcoesMagnitude = computed<EChartsCoreOption>(() => {
    const { c, estilo, grade } = this.eixos();
    const cor = { REGISTRO: c.textoSecundario, ATENCAO: c.atencao, ALTO: c.alto, CRITICO: c.critico };
    return {
      useUTC: true,
      backgroundColor: 'transparent',
      textStyle: { color: c.textoSecundario },
      tooltip: {
        trigger: 'item',
        formatter: (p: { data: { local: string; mag: number; prof: number; quando: string } }) =>
          `<strong>M${p.data.mag.toFixed(1)}</strong> ${p.data.local}<br/>Profundidade ${p.data.prof.toFixed(0)} km<br/>${p.data.quando}`,
      },
      grid: { left: 52, right: 24, top: 24, bottom: 60 },
      dataZoom: [{ type: 'inside' }, { type: 'slider', height: 20, bottom: 8 }],
      xAxis: { type: 'time', ...estilo },
      yAxis: { type: 'value', name: 'Magnitude', min: 3.5, nameTextStyle: { color: c.textoSecundario }, ...estilo, splitLine: grade },
      series: [
        {
          type: 'scatter',
          data: this.dados.pontos().map((p) => {
            const nivel = nivelDe(p.magnitude);
            return {
              value: [p.ocorridoEm, p.magnitude],
              symbol: SIMBOLO[nivel],
              symbolSize: 7 + Math.max(0, p.magnitude - 4) * 5,
              itemStyle: { color: cor[nivel], opacity: 0.9 },
              local: p.local, mag: p.magnitude, prof: p.profundidadeKm, quando: dataJst(p.ocorridoEm),
            };
          }),
        },
      ],
    };
  });

  // Quantos sismos em cada nivel
  protected readonly niveis = computed(() => {
    const p = this.dados.totais()?.porNivel;
    return p
      ? [
          { nivel: 'Crítico (M6,5 ou mais)', valor: p.CRITICO },
          { nivel: 'Alto (M5,5 a 6,4)', valor: p.ALTO },
          { nivel: 'Atenção (M4,5 a 5,4)', valor: p.ATENCAO },
          { nivel: 'Registro (menor que M4,5)', valor: p.REGISTRO },
        ]
      : [];
  });

  protected readonly opcoesNivel = computed<EChartsCoreOption>(() => {
    const { c, estilo, grade } = this.eixos();
    const cores = [c.critico, c.alto, c.atencao, c.textoSecundario];
    const lista = this.niveis();
    return {
      backgroundColor: 'transparent',
      textStyle: { color: c.textoSecundario },
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      grid: { left: 170, right: 40, top: 16, bottom: 28 },
      xAxis: { type: 'value', minInterval: 1, ...estilo, splitLine: grade },
      yAxis: { type: 'category', inverse: true, data: lista.map((n) => n.nivel), ...estilo },
      series: [{ type: 'bar', label: { show: true, position: 'right', color: c.texto }, data: lista.map((n, i) => ({ value: n.valor, itemStyle: { color: cores[i] } })) }],
    };
  });
}
