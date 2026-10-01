import { Component, computed, inject } from '@angular/core';
import type { EChartsCoreOption } from 'echarts/core';
import { BotaoRelatorio } from '../../../compartilhado/botao-relatorio/botao-relatorio';
import { Grafico } from '../../../compartilhado/grafico/grafico';
import { provedorGraficos } from '../../../compartilhado/grafico/echarts-config';
import { baseGrafico, degrade, eixoCategoria, eixoTempo, eixoValor, zoomSuave } from '../../../compartilhado/grafico/estilo-grafico';
import type { ExplicacaoGrafico } from '../../../compartilhado/grafico/explicacao-dialog/explicacao-dialog';

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

  protected readonly explicaLinha: ExplicacaoGrafico = {
    oQueMostra: 'Como a temperatura média mudou ao longo do período, hora a hora, dentro e fora do ambiente monitorado.',
    comoLer: 'Cada linha é um sentido de leitura: interno (tracejada, azul) e externo (contínua, laranja). Passe o mouse para ver o valor de cada hora e arraste a barra inferior para aproximar.',
    oQueObservar: 'Se a linha interna acompanha a externa, o ambiente está pouco isolado. Saltos bruscos podem indicar falha no sensor ou uma mudança real de condição.',
  };
  protected readonly explicaHora: ExplicacaoGrafico = {
    oQueMostra: 'A temperatura média em cada hora do dia (0h a 23h), somando todos os dias do período.',
    comoLer: 'Cada barra é uma hora do dia. Compare a altura das barras azuis (interno) e laranjas (externo) na mesma hora.',
    oQueObservar: 'Mostra o ritmo diário: em que horas esquenta e esfria. É útil para achar o melhor horário de medir ou de agir.',
  };

  protected readonly opcoesLinha = computed<EChartsCoreOption>(() => {
    const c = this.a11y.cores();
    const base = baseGrafico(c, this.a11y.reduzirMovimento());
    return {
      ...base,
      useUTC: true,
      tooltip: { ...base.tooltip, trigger: 'axis' },
      grid: { left: 56, right: 24, top: 44, bottom: 72 },
      xAxis: eixoTempo(c),
      yAxis: eixoValor(c, { name: 'Temperatura média (°C)', scale: true }),
      dataZoom: zoomSuave(c),
      series: this.sentidosPresentes().map((sentido) => ({
        name: ROTULOS[sentido],
        type: 'line',
        smooth: true,
        showSymbol: false,
        itemStyle: { color: this.corSentido()[sentido] },
        lineStyle: { width: 2.5, type: sentido === 'EXTERNO' ? 'solid' : 'dashed' }, // forma diferente alem da cor
        areaStyle: { color: degrade(this.corSentido()[sentido], 0.28, 0) },
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
    const c = this.a11y.cores();
    const base = baseGrafico(c, this.a11y.reduzirMovimento());
    return {
      ...base,
      tooltip: { ...base.tooltip, trigger: 'axis' },
      grid: { left: 56, right: 24, top: 44, bottom: 32 },
      xAxis: eixoCategoria(c, this.horas.map((h) => `${String(h).padStart(2, '0')}h`)),
      yAxis: eixoValor(c, { name: '°C', scale: true }),
      series: this.sentidosPresentes().map((sentido) => ({
        name: ROTULOS[sentido],
        type: 'bar',
        barMaxWidth: 16,
        itemStyle: { color: degrade(this.corSentido()[sentido], 0.95, 0.45), borderRadius: [6, 6, 0, 0] },
        data: this.mediaPorHora()[sentido],
      })),
    };
  });

  protected readonly rotulos = ROTULOS;
  protected readonly sentidos = computed(() => this.sentidosPresentes());
}
