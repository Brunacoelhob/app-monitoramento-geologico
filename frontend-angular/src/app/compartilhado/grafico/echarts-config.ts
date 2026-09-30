import * as echarts from 'echarts/core';
import { BarChart, EffectScatterChart, LineChart, ScatterChart } from 'echarts/charts';
import { BrushComponent, DataZoomComponent, GridComponent, LegendComponent, MarkAreaComponent, MarkPointComponent, TooltipComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import { provideEchartsCore } from 'ngx-echarts';

// Registra so os pedacos do ECharts usados (as paginas com graficos sao carregadas
// sob demanda, entao o ECharts so baixa quando elas abrem).
echarts.use([LineChart, BarChart, ScatterChart, EffectScatterChart, GridComponent, TooltipComponent, LegendComponent, DataZoomComponent, BrushComponent, MarkAreaComponent, MarkPointComponent, CanvasRenderer]);

export const provedorGraficos = () => provideEchartsCore({ echarts });
