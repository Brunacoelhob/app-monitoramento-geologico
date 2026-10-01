import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { CartaoKpi } from '../../compartilhado/cartao-kpi/cartao-kpi';
import { Hero } from '../../compartilhado/hero/hero';
import { MapaSismos } from '../../compartilhado/mapa-sismos/mapa-sismos';
import { SeloNivel } from '../../compartilhado/selo-nivel/selo-nivel';
import { SeloOrigem } from '../../compartilhado/selo-origem/selo-origem';
import { EstacoesServico } from '../../core/estacoes.servico';
import { AlertaResumo } from '../../core/modelos';
import { FUSO_JAPAO } from '../../core/nivel';
import { FiltrosSismosServico } from '../../core/filtros-sismos.servico';
import { SismosDados } from '../../core/sismos-dados.servico';
import { SismosServico } from '../../core/sismos.servico';
import { TempoRealServico } from '../../core/tempo-real.servico';
import { TemperaturaDados } from '../../core/temperatura-dados.servico';

// Visao geral dos dois modulos: sismos no Japao e temperatura das estacoes.
@Component({
  selector: 'app-inicio',
  imports: [DatePipe, RouterLink, CartaoKpi, Hero, MapaSismos, SeloNivel, SeloOrigem],
  templateUrl: './inicio.html',
  styleUrl: './inicio.scss',
})
export class Inicio {
  protected readonly sismos = inject(SismosDados);
  protected readonly temperatura = inject(TemperaturaDados);
  protected readonly estacoes = inject(EstacoesServico);
  private readonly api = inject(SismosServico);
  private readonly roteador = inject(Router);
  private readonly filtros = inject(FiltrosSismosServico);

  protected readonly alertas = signal<AlertaResumo[]>([]);
  protected readonly fuso = FUSO_JAPAO;

  protected readonly totalAlertas = computed(() => {
    const a = this.sismos.totais()?.alertasAbertos;
    return a ? a.ATENCAO + a.ALTO + a.CRITICO : null;
  });
  protected readonly sufixoEstacoes = computed(() => ` de ${this.sismos.totais()?.estacoes.ativas ?? 0}`);

  // Clicar em uma regiao do mapa abre a aba Mapa ja filtrada por ela
  protected escolherRegiao(codigo: string | null) {
    this.filtros.definirRegiao(codigo);
    if (codigo) this.roteador.navigate(['/sismos', 'mapa']);
  }

  constructor() {
    this.filtros.definirRegiao(null); // a visao geral mostra o mundo todo
    this.estacoes.carregar().subscribe({ error: () => undefined });
    const buscarAlertas = () => this.api.alertas({ estado: 'ABERTO' }, 1, 5).subscribe({ next: (r) => this.alertas.set(r.itens), error: () => undefined });
    buscarAlertas();

    // Tempo real: alertas e estacoes (online/offline) se atualizam sem recarregar a pagina
    inject(TempoRealServico)
      .avisos$.pipe(takeUntilDestroyed())
      .subscribe((aviso) => {
        if (aviso.tipo === 'alerta') buscarAlertas();
        if (aviso.tipo === 'leituras' || aviso.tipo === 'alerta') this.estacoes.carregar().subscribe({ error: () => undefined });
      });
  }

  protected irPara(rota: string) {
    this.roteador.navigateByUrl(rota);
  }
}
