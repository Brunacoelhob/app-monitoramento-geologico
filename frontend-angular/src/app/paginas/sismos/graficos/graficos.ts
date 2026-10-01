import { Component, computed, inject } from '@angular/core';
import type { EChartsCoreOption } from 'echarts/core';
import { BotaoRelatorio } from '../../../compartilhado/botao-relatorio/botao-relatorio';
import { provedorGraficos } from '../../../compartilhado/grafico/echarts-config';
import { baseGrafico, degrade, eixoCategoria, eixoTempo, eixoValor, zoomSuave } from '../../../compartilhado/grafico/estilo-grafico';
import type { ExplicacaoGrafico } from '../../../compartilhado/grafico/explicacao-dialog/explicacao-dialog';
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

  protected readonly explicaPorDia: ExplicacaoGrafico = {
    oQueMostra: 'Quantos terremotos foram registrados em cada dia e qual foi o mais forte daquele dia.',
    comoLer: 'As barras (eixo da esquerda) contam os sismos do dia. A linha tracejada (eixo da direita) é a maior magnitude do dia. Arraste a barra inferior para aproximar um trecho.',
    oQueObservar: 'Um dia com barra alta e linha alta pode indicar uma sequência de tremores (abalos secundários de um sismo forte). Barras altas com linha baixa são muitos tremores pequenos.',
  };
  protected readonly explicaMagnitude: ExplicacaoGrafico = {
    oQueMostra: 'Cada ponto é um terremoto: quando aconteceu (eixo horizontal) e com que força (eixo vertical).',
    comoLer: 'Quanto mais alto e maior o ponto, mais forte o sismo. A forma e a cor indicam o nível: círculo (registro), triângulo (atenção), losango (alto), quadrado (crítico). Passe o mouse para ver local e profundidade.',
    oQueObservar: 'Pontos agrupados no tempo sugerem uma sequência sísmica. Pontos no topo são os eventos que merecem atenção e podem gerar alerta.',
  };
  protected readonly explicaNivel: ExplicacaoGrafico = {
    oQueMostra: 'Quantos sismos do período caem em cada nível de magnitude.',
    comoLer: 'Cada barra é um nível, do mais grave (crítico) ao menos grave (registro). O número no fim da barra é a quantidade de sismos.',
    oQueObservar: 'A escala de magnitude é logarítmica: cada ponto a mais libera cerca de 32 vezes mais energia. Por isso os níveis graves são raros.',
  };

  // Sismos por dia (barras) e maior magnitude do dia (linha)
  protected readonly opcoesPorDia = computed<EChartsCoreOption>(() => {
    const c = this.a11y.cores();
    const base = baseGrafico(c, this.a11y.reduzirMovimento());
    const serie = this.dados.serieDiaria();
    return {
      ...base,
      tooltip: { ...base.tooltip, trigger: 'axis' },
      grid: { left: 52, right: 56, top: 44, bottom: 60 },
      dataZoom: zoomSuave(c),
      xAxis: eixoCategoria(c, serie.map((d) => this.dia(d.dia))),
      yAxis: [
        eixoValor(c, { name: 'Sismos', minInterval: 1 }),
        eixoValor(c, { name: 'Magnitude', min: 4, splitLine: { show: false } }),
      ],
      series: [
        { name: 'Sismos por dia', type: 'bar', barMaxWidth: 28, itemStyle: { color: degrade(c.acento), borderRadius: [8, 8, 0, 0] }, data: serie.map((d) => d.eventos) },
        { name: 'Maior magnitude do dia', type: 'line', yAxisIndex: 1, smooth: true, symbol: 'circle', symbolSize: 8, lineStyle: { type: 'dashed', width: 2.5, color: c.texto }, itemStyle: { color: c.texto, borderColor: c.fundo, borderWidth: 2 }, data: serie.map((d) => d.maiorMagnitude) },
      ],
    };
  });

  // Cada sismo: quando aconteceu x magnitude (forma e cor pelo nivel)
  protected readonly opcoesMagnitude = computed<EChartsCoreOption>(() => {
    const c = this.a11y.cores();
    const cor = { REGISTRO: c.textoSecundario, ATENCAO: c.atencao, ALTO: c.alto, CRITICO: c.critico };
    const base = baseGrafico(c, this.a11y.reduzirMovimento());
    return {
      ...base,
      useUTC: true,
      tooltip: {
        ...base.tooltip,
        trigger: 'item',
        formatter: (p: { data: { local: string; mag: number; prof: number; quando: string } }) =>
          `<strong>M${p.data.mag.toFixed(1)}</strong> ${p.data.local}<br/>Profundidade ${p.data.prof.toFixed(0)} km<br/>${p.data.quando}`,
      },
      grid: { left: 52, right: 24, top: 24, bottom: 60 },
      dataZoom: zoomSuave(c),
      xAxis: eixoTempo(c),
      yAxis: eixoValor(c, { name: 'Magnitude', min: 3.5 }),
      series: [
        {
          type: 'scatter',
          emphasis: { scale: 1.4 },
          data: this.dados.pontos().map((p) => {
            const nivel = nivelDe(p.magnitude);
            return {
              value: [p.ocorridoEm, p.magnitude],
              symbol: SIMBOLO[nivel],
              symbolSize: 7 + Math.max(0, p.magnitude - 4) * 5,
              itemStyle: { color: cor[nivel], opacity: 0.85, borderColor: c.fundo, borderWidth: 1 },
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
    const c = this.a11y.cores();
    const cores = [c.critico, c.alto, c.atencao, c.textoSecundario];
    const lista = this.niveis();
    const base = baseGrafico(c, this.a11y.reduzirMovimento());
    return {
      ...base,
      tooltip: { ...base.tooltip, trigger: 'axis', axisPointer: { type: 'shadow' } },
      grid: { left: 170, right: 40, top: 16, bottom: 28 },
      xAxis: eixoValor(c, { minInterval: 1 }),
      yAxis: { ...eixoCategoria(c, lista.map((n) => n.nivel)), inverse: true },
      series: [{ type: 'bar', barMaxWidth: 26, label: { show: true, position: 'right', color: c.texto, fontWeight: 700 }, data: lista.map((n, i) => ({ value: n.valor, itemStyle: { color: cores[i], borderRadius: [0, 8, 8, 0] } })) }],
    };
  });
}
