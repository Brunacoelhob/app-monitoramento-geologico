import { DatePipe } from '@angular/common';
import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar } from '@angular/material/snack-bar';
import type { EChartsCoreOption } from 'echarts/core';
import { Grafico } from '../../compartilhado/grafico/grafico';
import { provedorGraficos } from '../../compartilhado/grafico/echarts-config';
import { CabecalhoPagina } from '../../compartilhado/cabecalho-pagina/cabecalho-pagina';
import { SeloOrigem } from '../../compartilhado/selo-origem/selo-origem';
import { AcessibilidadeServico } from '../../core/acessibilidade.servico';
import { mensagemDeErro } from '../../core/arquivo';
import { AuthServico } from '../../core/auth.servico';
import { EstacoesServico } from '../../core/estacoes.servico';
import { Estacao, SeriesEstacao } from '../../core/modelos';
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

  private base(nome: string, unidade: string) {
    const c = this.a11y.cores();
    const estilo = { axisLabel: { color: c.textoSecundario }, axisLine: { lineStyle: { color: c.linha } } };
    return {
      c,
      comum: {
        useUTC: true, backgroundColor: 'transparent', textStyle: { color: c.textoSecundario },
        tooltip: { trigger: 'axis' }, legend: { top: 0, textStyle: { color: c.textoSecundario } },
        grid: { left: 56, right: 24, top: 44, bottom: 56 },
        dataZoom: [{ type: 'inside' }],
        xAxis: { type: 'time', ...estilo },
        yAxis: { type: 'value', name: unidade, scale: true, nameTextStyle: { color: c.textoSecundario }, ...estilo, splitLine: { lineStyle: { color: c.linha } } },
      },
      nome,
    };
  }

  protected readonly opcoesSismografo = computed<EChartsCoreOption>(() => {
    const { c, comum } = this.base('Sismógrafo', 'Amplitude (mm/s)');
    const s = this.series();
    return { ...comum, series: [{ name: 'Amplitude', type: 'line', showSymbol: false, lineStyle: { width: 1.5, color: c.acento }, itemStyle: { color: c.acento }, data: (s?.sismografo ?? []).map((p) => [p.instante, p.amplitude]) }] };
  });

  protected readonly opcoesGps = computed<EChartsCoreOption>(() => {
    const { c, comum } = this.base('GPS', 'Deslocamento (mm)');
    const s = this.series();
    return {
      ...comum,
      series: [
        { name: 'Leste', type: 'line', showSymbol: false, lineStyle: { width: 2, color: c.acento }, itemStyle: { color: c.acento }, data: (s?.gps ?? []).map((p) => [p.instante, p.deslocamentoLesteMm]) },
        { name: 'Norte', type: 'line', showSymbol: false, lineStyle: { width: 2, type: 'dashed', color: c.texto }, itemStyle: { color: c.texto }, data: (s?.gps ?? []).map((p) => [p.instante, p.deslocamentoNorteMm]) },
      ],
    };
  });

  protected readonly opcoesTemperatura = computed<EChartsCoreOption>(() => {
    const { c, comum } = this.base('Temperatura', 'Temperatura (°C)');
    const s = this.series();
    const de = (sentido: string) => (s?.temperatura ?? []).filter((p) => p.sentido === sentido).map((p) => [p.instante, p.temperatura]);
    return {
      ...comum,
      series: [
        { name: 'Interno', type: 'line', showSymbol: false, lineStyle: { width: 2, type: 'dashed', color: c.frio }, itemStyle: { color: c.frio }, data: de('INTERNO') },
        { name: 'Externo', type: 'line', showSymbol: false, lineStyle: { width: 2, color: c.calor }, itemStyle: { color: c.calor }, data: de('EXTERNO') },
      ],
    };
  });
}
