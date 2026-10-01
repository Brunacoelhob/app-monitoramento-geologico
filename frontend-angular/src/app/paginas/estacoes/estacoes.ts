import { DatePipe } from '@angular/common';
import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar } from '@angular/material/snack-bar';
import type { EChartsCoreOption } from 'echarts/core';
import { Grafico } from '../../compartilhado/grafico/grafico';
import { baseGrafico, degrade, eixoTempo, eixoValor } from '../../compartilhado/grafico/estilo-grafico';
import type { ExplicacaoGrafico } from '../../compartilhado/grafico/explicacao-dialog/explicacao-dialog';
import { provedorGraficos } from '../../compartilhado/grafico/echarts-config';
import { CabecalhoPagina } from '../../compartilhado/cabecalho-pagina/cabecalho-pagina';
import { SeloOrigem } from '../../compartilhado/selo-origem/selo-origem';
import { AcessibilidadeServico } from '../../core/acessibilidade.servico';
import { mensagemDeErro } from '../../core/arquivo';
import { AuthServico } from '../../core/auth.servico';
import { EstacoesServico } from '../../core/estacoes.servico';
import { Estacao, SeriesEstacao } from '../../core/modelos';
import { TempoRealServico } from '../../core/tempo-real.servico';
import { FUSO_JAPAO } from '../../core/nivel';
import { ChaveDialog } from './chave-dialog/chave-dialog';
import { NovaEstacaoDialog } from './nova-estacao-dialog/nova-estacao-dialog';

const TIPOS = { SISMOGRAFO: 'Sismógrafo', GPS: 'GPS', TEMPERATURA: 'Temperatura' };

@Component({
  selector: 'app-estacoes',
  imports: [DatePipe, MatButtonModule, MatFormFieldModule, MatIconModule, MatSelectModule, Grafico, CabecalhoPagina, SeloOrigem],
  providers: [provedorGraficos()],
  templateUrl: './estacoes.html',
  styleUrl: './estacoes.scss',
})
export class Estacoes {
  // Vem da URL: /estacoes?estacao=3 (link do detalhe do alerta)
  readonly estacao = input<string>();

  protected readonly estacoes = inject(EstacoesServico);
  protected readonly auth = inject(AuthServico);
  private readonly dialogo = inject(MatDialog);
  private readonly aviso = inject(MatSnackBar);
  private readonly a11y = inject(AcessibilidadeServico);

  protected readonly fuso = FUSO_JAPAO;
  protected readonly ehAdmin = computed(() => this.auth.usuario()?.papel === 'ADMIN');
  protected readonly selecionada = signal<Estacao | null>(null);
  protected readonly series = signal<SeriesEstacao | null>(null);
  protected readonly horas = signal(24);
  protected readonly carregandoSeries = signal(false);

  constructor() {
    this.estacoes.carregar().subscribe({ error: () => undefined });
    // Tempo real: situacao online/offline e ultima leitura se atualizam sozinhas
    inject(TempoRealServico)
      .avisos$.pipe(takeUntilDestroyed())
      .subscribe((aviso) => {
        if (aviso.tipo === 'leituras' || aviso.tipo === 'alerta') this.estacoes.carregar().subscribe({ error: () => undefined });
      });
    // Abre direto a estacao pedida na URL
    effect(() => {
      const id = Number(this.estacao());
      const lista = this.estacoes.estacoes();
      if (id && lista.length && this.selecionada()?.id !== id) {
        const achada = lista.find((e) => e.id === id);
        if (achada) this.ver(achada);
      }
    });
  }

  protected tiposDe(e: Estacao): string {
    return [...new Set(e.sensores.map((s) => TIPOS[s.tipo]))].join(', ');
  }

  protected situacao(e: Estacao): { icone: string; texto: string } {
    if (!e.ativa) return { icone: 'block', texto: 'Inativa' };
    if (!e.monitoraComunicacao) return { icone: 'history', texto: 'Somente histórico' };
    return e.online ? { icone: 'check_circle', texto: 'Online' } : { icone: 'error', texto: 'Sem comunicação' };
  }

  protected ver(e: Estacao, horas = this.horas()) {
    this.selecionada.set(e);
    this.horas.set(horas);
    this.carregandoSeries.set(true);
    this.estacoes.series(e.id, horas).subscribe({
      next: (s) => { this.series.set(s); this.carregandoSeries.set(false); },
      error: () => { this.series.set(null); this.carregandoSeries.set(false); },
    });
  }

  protected mudarHoras(h: number) {
    const e = this.selecionada();
    if (e) this.ver(e, h);
  }

  protected nova() {
    this.dialogo.open(NovaEstacaoDialog, { maxWidth: '94vw', autoFocus: 'first-tabbable' });
  }

  protected alternar(e: Estacao) {
    this.estacoes.definirSituacao(e.id, !e.ativa).subscribe({
      next: () => this.aviso.open(e.ativa ? `${e.nome} desativada.` : `${e.nome} ativada.`, 'Ok', { duration: 4000 }),
      error: async (erro: unknown) => this.aviso.open(await mensagemDeErro(erro, 'Não foi possível alterar a estação.'), 'Fechar', { duration: 6000 }),
    });
  }

  protected novaChave(e: Estacao) {
    this.estacoes.novaChave(e.id).subscribe({
      next: ({ chave }) => this.dialogo.open(ChaveDialog, { data: { nome: e.nome, chave }, maxWidth: '92vw', disableClose: true }),
      error: async (erro: unknown) => this.aviso.open(await mensagemDeErro(erro, 'Não foi possível gerar a chave.'), 'Fechar', { duration: 6000 }),
    });
  }

  // ---------- graficos das series ----------

  protected readonly explicaSismografo: ExplicacaoGrafico = {
    oQueMostra: 'A amplitude do sinal do sismógrafo da estação ao longo das últimas horas.',
    comoLer: 'A linha é o "ruído de fundo" da Terra. Picos isolados e altos são vibrações fortes; passe o mouse para ver o valor e o horário.',
    oQueObservar: 'Um pico logo depois de um terremoto próximo (veja em Sismos) é esperado. Linha reta por muito tempo pode indicar sensor parado.',
  };
  protected readonly explicaGps: ExplicacaoGrafico = {
    oQueMostra: 'Quanto o receptor GPS se deslocou para leste e para norte, em milímetros.',
    comoLer: 'Linha contínua: deslocamento para leste. Linha tracejada: deslocamento para norte. O movimento lento e constante é o das placas tectônicas.',
    oQueObservar: 'Um salto repentino costuma acompanhar um terremoto forte; uma tendência suave é o movimento normal da placa.',
  };
  protected readonly explicaTemperatura: ExplicacaoGrafico = {
    oQueMostra: 'A temperatura medida pela estação, dentro e fora do ambiente.',
    comoLer: 'Linha tracejada azul: interna. Linha contínua laranja: externa. As áreas coloridas só reforçam o formato da curva.',
    oQueObservar: 'Se a interna acompanha a externa, o ambiente está pouco isolado. Saltos bruscos podem ser falha do sensor.',
  };

  private base(unidade: string) {
    const c = this.a11y.cores();
    const base = baseGrafico(c, this.a11y.reduzirMovimento());
    return {
      c,
      comum: {
        ...base,
        useUTC: true,
        tooltip: { ...base.tooltip, trigger: 'axis' },
        grid: { left: 56, right: 24, top: 44, bottom: 40 },
        dataZoom: [{ type: 'inside' }],
        xAxis: eixoTempo(c),
        yAxis: eixoValor(c, { name: unidade, scale: true }),
      },
    };
  }

  protected readonly opcoesSismografo = computed<EChartsCoreOption>(() => {
    const { c, comum } = this.base('Amplitude (mm/s)');
    const s = this.series();
    return { ...comum, series: [{ name: 'Amplitude', type: 'line', showSymbol: false, smooth: true, lineStyle: { width: 1.8, color: c.acento }, itemStyle: { color: c.acento }, areaStyle: { color: degrade(c.acento, 0.25, 0) }, data: (s?.sismografo ?? []).map((p) => [p.instante, p.amplitude]) }] };
  });

  protected readonly opcoesGps = computed<EChartsCoreOption>(() => {
    const { c, comum } = this.base('Deslocamento (mm)');
    const s = this.series();
    return {
      ...comum,
      series: [
        { name: 'Leste', type: 'line', showSymbol: false, smooth: true, lineStyle: { width: 2, color: c.acento }, itemStyle: { color: c.acento }, data: (s?.gps ?? []).map((p) => [p.instante, p.deslocamentoLesteMm]) },
        { name: 'Norte', type: 'line', showSymbol: false, smooth: true, lineStyle: { width: 2, type: 'dashed', color: c.texto }, itemStyle: { color: c.texto }, data: (s?.gps ?? []).map((p) => [p.instante, p.deslocamentoNorteMm]) },
      ],
    };
  });

  protected readonly opcoesTemperatura = computed<EChartsCoreOption>(() => {
    const { c, comum } = this.base('Temperatura (°C)');
    const s = this.series();
    const de = (sentido: string) => (s?.temperatura ?? []).filter((p) => p.sentido === sentido).map((p) => [p.instante, p.temperatura]);
    return {
      ...comum,
      series: [
        { name: 'Interno', type: 'line', showSymbol: false, smooth: true, lineStyle: { width: 2.5, type: 'dashed', color: c.frio }, itemStyle: { color: c.frio }, areaStyle: { color: degrade(c.frio, 0.22, 0) }, data: de('INTERNO') },
        { name: 'Externo', type: 'line', showSymbol: false, smooth: true, lineStyle: { width: 2.5, color: c.calor }, itemStyle: { color: c.calor }, areaStyle: { color: degrade(c.calor, 0.22, 0) }, data: de('EXTERNO') },
      ],
    };
  });
}
