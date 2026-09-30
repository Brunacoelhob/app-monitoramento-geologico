import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { RouterLink } from '@angular/router';
import { EMPTY, catchError, filter, switchMap } from 'rxjs';
import { CartaoKpi } from '../../../compartilhado/cartao-kpi/cartao-kpi';
import { DadosInfoKpi, InfoKpiDialog } from '../../../compartilhado/info-kpi-dialog/info-kpi-dialog';
import { SeloNivel } from '../../../compartilhado/selo-nivel/selo-nivel';
import { FiltrosSismosServico } from '../../../core/filtros-sismos.servico';
import { AlertaResumo, EventoSismico, FiltrosSismos } from '../../../core/modelos';
import { dataJst, nivelDe } from '../../../core/nivel';
import { SismosDados } from '../../../core/sismos-dados.servico';
import { SismosServico } from '../../../core/sismos.servico';

const numero = new Intl.NumberFormat('pt-BR');
const dec = (n: number, c = 1) => n.toLocaleString('pt-BR', { minimumFractionDigits: c, maximumFractionDigits: c });

@Component({
  selector: 'app-sismos-resumo',
  imports: [DatePipe, MatButtonModule, MatProgressBarModule, RouterLink, CartaoKpi, SeloNivel],
  templateUrl: './resumo.html',
  styleUrl: './resumo.scss',
})
export class Resumo {
  protected readonly filtros = inject(FiltrosSismosServico);
  protected readonly dados = inject(SismosDados);
  private readonly sismos = inject(SismosServico);
  private readonly dialogo = inject(MatDialog);

  protected readonly alertasAbertos = signal<AlertaResumo[]>([]);
  protected readonly ultimos = signal<EventoSismico[]>([]);
  protected readonly nivelDe = nivelDe;
  protected readonly dataJst = dataJst;

  protected readonly totalAlertas = computed(() => {
    const a = this.dados.totais()?.alertasAbertos;
    return a ? a.ATENCAO + a.ALTO + a.CRITICO : null;
  });
  protected readonly descricaoAlertas = computed(() => {
    const a = this.dados.totais()?.alertasAbertos;
    return a ? `Atenção ${a.ATENCAO}, Alto ${a.ALTO}, Crítico ${a.CRITICO}` : '';
  });
  protected readonly sufixoEstacoes = computed(() => ` de ${this.dados.totais()?.estacoes.ativas ?? 0}`);

  constructor() {
    // Lista curta de alertas em aberto e dos ultimos sismos do periodo
    this.sismos.alertas({ estado: 'ABERTO' }, 1, 5).subscribe({ next: (r) => this.alertasAbertos.set(r.itens), error: () => undefined });
    toObservable(this.filtros.consulta)
      .pipe(
        filter((c): c is FiltrosSismos => c !== null),
        switchMap((c) => this.sismos.eventos(c, 1, 8).pipe(catchError(() => EMPTY))),
        takeUntilDestroyed(),
      )
      .subscribe((r) => this.ultimos.set(r.itens));
  }

  protected abrir(tipo: 'eventos' | 'maior' | 'alertas' | 'estacoes') {
    const t = this.dados.totais();
    const c = this.filtros.consulta();
    if (!t || !c) return;
    const br = (iso: string) => iso.split('-').reverse().join('/');
    const periodo = `${br(c.inicio)} a ${br(c.fim)}`;
    const total = t.totalEventos || 1;
    const linhasNivel = (['CRITICO', 'ALTO', 'ATENCAO', 'REGISTRO'] as const).map((n) => ({
      rotulo: { CRITICO: 'Crítico (M6,5 ou mais)', ALTO: 'Alto (M5,5 a 6,4)', ATENCAO: 'Atenção (M4,5 a 5,4)', REGISTRO: 'Registro (menor que M4,5)' }[n],
      texto: `${numero.format(t.porNivel[n])}`,
      proporcao: t.porNivel[n] / total,
      cor: { CRITICO: 'var(--sev-critico)', ALTO: 'var(--sev-alto)', ATENCAO: 'var(--sev-atencao)', REGISTRO: 'var(--texto-2)' }[n],
    }));

    const conteudo: Record<typeof tipo, DadosInfoKpi> = {
      eventos: {
        titulo: 'Sismos no período', icone: 'public', periodo, destaque: numero.format(t.totalEventos), unidade: 'sismos',
        oQueE: 'Quantidade de terremotos registrados pelo USGS na região do Japão, dentro do período e dos filtros escolhidos.',
        comoCalcula: 'Contagem dos eventos com magnitude de 4,0 ou mais. Eventos cancelados pela fonte não entram.',
        tituloLinhas: 'Por nível de magnitude', linhas: linhasNivel,
        dica: 'Só os eventos de magnitude 4,5 ou mais geram alerta.',
      },
      maior: {
        titulo: 'Maior magnitude', icone: 'vertical_align_top', periodo, destaque: t.maiorMagnitude !== null ? dec(t.maiorMagnitude) : '-', unidade: 'M',
        oQueE: 'A magnitude do sismo mais forte do período. A magnitude mede a energia liberada: cada ponto a mais é cerca de 32 vezes mais energia.',
        comoCalcula: 'Maior valor de magnitude entre os eventos do período e dos filtros.',
        dica: 'Sismos rasos (pouca profundidade) costumam ser sentidos com mais força na superfície.',
      },
      alertas: {
        titulo: 'Alertas abertos', icone: 'notifications_active', destaque: numero.format(this.totalAlertas() ?? 0), unidade: 'alertas',
        oQueE: 'Alertas que ainda precisam de atenção: abertos ou reconhecidos e não encerrados. Este número não muda com o período escolhido.',
        comoCalcula: 'Contagem de alertas com estado aberto ou reconhecido, por nível.',
        tituloLinhas: 'Por nível',
        linhas: (['CRITICO', 'ALTO', 'ATENCAO'] as const).map((n) => ({ rotulo: { CRITICO: 'Crítico', ALTO: 'Alto', ATENCAO: 'Atenção' }[n], texto: String(t.alertasAbertos[n]) })),
        dica: 'Alertas de nível Atenção se encerram sozinhos 72 horas depois do sismo.',
      },
      estacoes: {
        titulo: 'Estações online', icone: 'sensors', destaque: `${t.estacoes.online} de ${t.estacoes.ativas}`, unidade: 'estações',
        oQueE: 'Estações ativas que enviaram ao menos uma leitura nos últimos 15 minutos.',
        comoCalcula: 'Estações com leitura recente dividido pelo total de estações ativas que são monitoradas.',
        dica: 'Uma estação sem comunicação abre um alerta de nível Atenção.',
      },
    };
    this.dialogo.open(InfoKpiDialog, { data: conteudo[tipo], maxWidth: '92vw', autoFocus: 'dialog' });
  }
}
