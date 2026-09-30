import { Component, computed, inject } from '@angular/core';
import type { EChartsCoreOption } from 'echarts/core';
import { BotaoRelatorio } from '../../../compartilhado/botao-relatorio/botao-relatorio';
import { Grafico } from '../../../compartilhado/grafico/grafico';
import { provedorGraficos } from '../../../compartilhado/grafico/echarts-config';
import { AcessibilidadeServico } from '../../../core/acessibilidade.servico';
import { FiltrosServico } from '../../../core/filtros.servico';
import { Sentido } from '../../../core/modelos';
import { TemperaturaDados } from '../../../core/temperatura-dados.servico';

const ROTULOS: Record<Sentido, string> = { INTERNO: 'Interno', EXTERNO: 'Externo' };

@Component({
  selector: 'app-temperatura-graficos',
  imports: [BotaoRelatorio, Grafico],
  providers: [provedorGraficos()],
  templateUrl: './graficos.html',
  styleUrl: './graficos.scss',
})
export class Graficos {
  protected readonly filtros = inject(FiltrosServico);
  protected readonly dados = inject(TemperaturaDados);
  private readonly a11y = inject(AcessibilidadeServico);

  protected readonly semLeituras = computed(() => !this.dados.carregando() && this.dados.serie().length === 0);

  private readonly corSentido = computed<Record<Sentido, string>>(() => {
    const c = this.a11y.cores();
    return { INTERNO: c.frio, EXTERNO: c.calor };
  });

  private sentidosPresentes(): Sentido[] {
    return (['INTERNO', 'EXTERNO'] as Sentido[]).filter((s) => this.dados.serie().some((p) => p.sentido === s));
  }

  private eixos() {
    const c = this.a11y.cores();
    return {
      texto: c.textoSecundario,
      linha: c.linha,
      estiloEixo: { axisLabel: { color: c.textoSecundario }, axisLine: { lineStyle: { color: c.linha } } },
    };
  }

  protected readonly opcoesLinha = computed<EChartsCoreOption>(() => {
    const { texto, linha, estiloEixo } = this.eixos();
    return {
      useUTC: true,
      backgroundColor: 'transparent',
      textStyle: { color: texto },
      tooltip: { trigger: 'axis' },
      legend: { top: 0, textStyle: { color: texto } },
      grid: { left: 56, right: 24, top: 44, bottom: 72 },
      xAxis: { type: 'time', ...estiloEixo },
      yAxis: { type: 'value', name: 'Temperatura média (°C)', scale: true, nameTextStyle: { color: texto }, ...estiloEixo, splitLine: { lineStyle: { color: linha } } },
      dataZoom: [{ type: 'inside' }, { type: 'slider', height: 22, bottom: 16 }],
      series: this.sentidosPresentes().map((sentido) => ({
        name: ROTULOS[sentido],
        type: 'line',
        showSymbol: false,
        itemStyle: { color: this.corSentido()[sentido] },
        lineStyle: { width: 2, type: sentido === 'EXTERNO' ? 'solid' : 'dashed' }, // forma diferente alem da cor
        data: this.dados.serie().filter((p) => p.sentido === sentido).map((p) => [p.hora, p.temperaturaMedia]),
      })),
    };
  });

  // Media por hora do dia (0h a 23h), calculada a partir das medias horarias.
  protected readonly mediaPorHora = computed(() =>
    Object.fromEntries(
      (['INTERNO', 'EXTERNO'] as Sentido[]).map((sentido) => {
        const somas = new Array<number>(24).fill(0);
        const contagens = new Array<number>(24).fill(0);
        for (const p of this.dados.serie()) {
          if (p.sentido !== sentido) continue;
          const hora = new Date(p.hora).getUTCHours();
          somas[hora] += p.temperaturaMedia;
          contagens[hora] += 1;
        }
        return [sentido, somas.map((s, h) => (contagens[h] ? Number((s / contagens[h]).toFixed(2)) : null))];
      }),
    ) as Record<Sentido, (number | null)[]>,
  );

  protected readonly horas = Array.from({ length: 24 }, (_, h) => h);

  protected readonly opcoesHoraDoDia = computed<EChartsCoreOption>(() => {
    const { texto, linha, estiloEixo } = this.eixos();
    return {
      backgroundColor: 'transparent',
      textStyle: { color: texto },
      tooltip: { trigger: 'axis' },
      legend: { top: 0, textStyle: { color: texto } },
      grid: { left: 56, right: 24, top: 44, bottom: 32 },
      xAxis: { type: 'category', data: this.horas.map((h) => `${String(h).padStart(2, '0')}h`), ...estiloEixo },
      yAxis: { type: 'value', name: '°C', scale: true, nameTextStyle: { color: texto }, ...estiloEixo, splitLine: { lineStyle: { color: linha } } },
      series: this.sentidosPresentes().map((sentido) => ({
        name: ROTULOS[sentido],
        type: 'bar',
        itemStyle: { color: this.corSentido()[sentido] },
        data: this.mediaPorHora()[sentido],
      })),
    };
  });

  protected readonly rotulos = ROTULOS;
  protected readonly sentidos = computed(() => this.sentidosPresentes());
}
