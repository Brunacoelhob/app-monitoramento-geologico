import type { CoresGrafico } from '../../core/acessibilidade.servico';

const FONTE = 'Manrope, system-ui, sans-serif';

// Base visual comum a todos os graficos: sem moldura pesada, grade tracejada suave,
// dica (tooltip) arredondada e animacao curta (desligada em "reduzir animacoes").
export function baseGrafico(c: CoresGrafico, reduzirMovimento: boolean) {
  return {
    backgroundColor: 'transparent',
    textStyle: { color: c.textoSecundario, fontFamily: FONTE },
    animation: !reduzirMovimento,
    animationDuration: 700,
    animationEasing: 'cubicOut' as const,
    tooltip: {
      backgroundColor: c.fundo,
      borderColor: c.linha,
      borderWidth: 1,
      padding: [10, 14],
      extraCssText: 'border-radius:12px;box-shadow:0 12px 32px rgba(15,23,42,.18);',
      textStyle: { color: c.texto, fontFamily: FONTE, fontSize: 13 },
      axisPointer: { lineStyle: { color: c.textoSecundario, type: 'dashed' as const }, shadowStyle: { color: 'rgba(120,130,160,.12)' } },
    },
    legend: { top: 0, icon: 'circle', itemWidth: 10, itemHeight: 10, itemGap: 18, textStyle: { color: c.textoSecundario, fontFamily: FONTE } },
  };
}

// Eixos discretos: sem linha do eixo nem marcas; so a grade tracejada no eixo dos valores.
export function eixoCategoria(c: CoresGrafico, dados?: string[]) {
  return { type: 'category' as const, data: dados, axisLine: { lineStyle: { color: c.linha } }, axisTick: { show: false }, axisLabel: { color: c.textoSecundario } };
}

export function eixoTempo(c: CoresGrafico) {
  return { type: 'time' as const, axisLine: { lineStyle: { color: c.linha } }, axisTick: { show: false }, axisLabel: { color: c.textoSecundario } };
}

export function eixoValor(c: CoresGrafico, extra: Record<string, unknown> = {}) {
  return {
    type: 'value' as const,
    axisLine: { show: false },
    axisTick: { show: false },
    axisLabel: { color: c.textoSecundario },
    nameTextStyle: { color: c.textoSecundario, fontWeight: 600 },
    splitLine: { lineStyle: { color: c.linha, type: 'dashed' as const } },
    ...extra,
  };
}

// Degrade vertical: cor cheia no topo, transparente embaixo (areas e barras)
export function degrade(cor: string, topo = 0.9, base = 0.25) {
  return {
    type: 'linear' as const,
    x: 0, y: 0, x2: 0, y2: 1,
    colorStops: [
      { offset: 0, color: comOpacidade(cor, topo) },
      { offset: 1, color: comOpacidade(cor, base) },
    ],
  };
}

function comOpacidade(hex: string, a: number): string {
  const n = hex.replace('#', '');
  const r = parseInt(n.slice(0, 2), 16);
  const g = parseInt(n.slice(2, 4), 16);
  const b = parseInt(n.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
}

// Controle de zoom discreto (em vez da barra cinza padrao)
export function zoomSuave(c: CoresGrafico) {
  return [
    { type: 'inside' as const },
    { type: 'slider' as const, height: 18, bottom: 10, borderColor: 'transparent', backgroundColor: c.linha, fillerColor: 'rgba(120,140,220,.22)', handleSize: 14, textStyle: { color: c.textoSecundario }, dataBackground: { lineStyle: { opacity: 0 }, areaStyle: { opacity: 0 } } },
  ];
}
