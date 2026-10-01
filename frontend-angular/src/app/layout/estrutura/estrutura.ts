import { BreakpointObserver } from '@angular/cdk/layout';
import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatMenuModule } from '@angular/material/menu';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ActivatedRoute, NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter, map, startWith } from 'rxjs';
import { Alarme } from '../../compartilhado/alarme/alarme';
import { AuthServico } from '../../core/auth.servico';
import { PerfilServico } from '../../core/perfil.servico';
import { TempoRealServico } from '../../core/tempo-real.servico';

const CHAVE_MENU = 'iot.menu';

const ITENS_MENU = [
  { rota: '/inicio', rotulo: 'Início', icone: 'home' },
  { rota: '/temperatura', rotulo: 'Temperatura', icone: 'device_thermostat' },
  { rota: '/sismos', rotulo: 'Sismos', icone: 'public' },
  { rota: '/alertas', rotulo: 'Alertas', icone: 'notifications_active' },
  { rota: '/estacoes', rotulo: 'Estações', icone: 'sensors' },
  { rota: '/perfil', rotulo: 'Meu perfil', icone: 'account_circle' },
];

@Component({
  selector: 'app-estrutura',
  imports: [
    Alarme,
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    MatButtonModule,
    MatIconModule,
    MatListModule,
    MatMenuModule,
    MatSidenavModule,
    MatToolbarModule,
    MatTooltipModule,
  ],
  templateUrl: './estrutura.html',
  styleUrl: './estrutura.scss',
})
export class Estrutura {
  protected readonly auth = inject(AuthServico);
  protected readonly perfil = inject(PerfilServico);
  private readonly roteador = inject(Router);
  private readonly rota = inject(ActivatedRoute);

  // Em telas estreitas o menu vira uma gaveta que abre por cima do conteudo.
  private readonly ehCelular = toSignal(
    inject(BreakpointObserver)
      .observe('(max-width: 900px)')
      .pipe(map((estado) => estado.matches)),
    { initialValue: false },
  );
  protected readonly modoMenu = computed(() => (this.ehCelular() ? 'over' : 'side'));

  // Menu aberto/recolhido. No desktop a escolha fica salva; no celular ele
  // comeca fechado para nao cobrir o conteudo.
  protected readonly tempoReal = inject(TempoRealServico);
  protected readonly menuAberto = signal(this.preferenciaMenu());

  // "Usuarios" so aparece para o administrador
  protected readonly itensMenu = computed(() => {
    const itens = [...ITENS_MENU];
    if (this.auth.usuario()?.papel === 'ADMIN') itens.splice(itens.length - 1, 0, { rota: '/usuarios', rotulo: 'Usuários', icone: 'group' });
    return itens;
  });

  // Dados da rota atual (vem de "data" em app.routes.ts): titulo da secao e se ocupa a largura toda
  private readonly dadosRota = toSignal(
    this.roteador.events.pipe(
      filter((e) => e instanceof NavigationEnd),
      startWith(null),
      map((): Record<string, unknown> => {
        let atual = this.rota;
        while (atual.firstChild) atual = atual.firstChild;
        return atual.snapshot?.data ?? {};
      }),
    ),
    { initialValue: {} as Record<string, unknown> },
  );

  // Nome da secao atual na barra superior
  protected readonly secao = computed(() => (this.dadosRota()['titulo'] as string | undefined) ?? '');
  // Paginas de largura total (a Inicio, com o hero de borda a borda)
  protected readonly larga = computed(() => this.dadosRota()['larguraTotal'] === true);

  protected readonly iniciais = computed(() => {
    const dados = this.perfil.perfil();
    const base = dados?.nome || this.auth.usuario()?.email || '?';
    const partes = base.split(/[\s@.]+/).filter(Boolean);
    return ((partes[0]?.[0] ?? '?') + (partes.length > 1 ? partes[1][0] : '')).toUpperCase();
  });

  constructor() {
    // Carrega o perfil (nome e avatar aparecem na barra superior).
    this.perfil.carregar().subscribe({ error: () => undefined });

    // Ao trocar de celular para desktop (ou vice-versa), ajusta o menu.
    effect(() => {
      const celular = this.ehCelular();
      untracked(() => this.menuAberto.set(celular ? false : this.preferenciaMenu()));
    });
  }

  protected alternarMenu(): void {
    this.menuAberto.update((aberto) => !aberto);
    if (!this.ehCelular()) {
      try {
        localStorage.setItem(CHAVE_MENU, this.menuAberto() ? 'aberto' : 'recolhido');
      } catch {
        // sem storage a preferencia so vale nesta sessao
      }
    }
  }

  protected aoNavegar(): void {
    if (this.ehCelular()) this.menuAberto.set(false);
  }

  private preferenciaMenu(): boolean {
    try {
      return localStorage.getItem(CHAVE_MENU) !== 'recolhido';
    } catch {
      return true;
    }
  }
}
