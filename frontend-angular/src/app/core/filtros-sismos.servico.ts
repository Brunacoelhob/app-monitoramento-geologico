import { Injectable, computed, inject, signal } from '@angular/core';
import { DIAS_PERIODO_PADRAO, diasAntes, hoje, paraDataApi } from './filtros.servico';
import { FiltrosSismos, NivelAlerta, Origem } from './modelos';
import { SismosServico } from './sismos.servico';

// Estado dos filtros do modulo de sismos, compartilhado entre as abas (RN-23):
// padrao = ultimos 30 dias ate hoje, escolhido so pelo calendario, sem limite de dias.
@Injectable({ providedIn: 'root' })
export class FiltrosSismosServico {
  private readonly sismos = inject(SismosServico);

  readonly inicio = signal<Date | null>(diasAntes(hoje(), DIAS_PERIODO_PADRAO));
  readonly fim = signal<Date | null>(hoje());
  readonly regiao = signal<string | null>(null); // null = mundo todo
  readonly magnitudeMin = signal<number | null>(null);
  readonly nivel = signal<NivelAlerta | null>(null);
  readonly origem = signal<Origem | null>(null);
  readonly estacaoId = signal<number | null>(null);

  readonly limites = signal<{ min: Date; max: Date } | null>(null);
  readonly periodoComDados = signal<{ inicio: Date; fim: Date } | null>(null);

  readonly consulta = computed<FiltrosSismos | null>(() => {
    const inicio = this.inicio();
    const fim = this.fim();
    if (!inicio || !fim) return null;
    return {
      inicio: paraDataApi(inicio),
      fim: paraDataApi(fim),
      regiao: this.regiao() ?? undefined,
      magnitudeMin: this.magnitudeMin() ?? undefined,
      nivel: this.nivel() ?? undefined,
      origem: this.origem() ?? undefined,
      estacaoId: this.estacaoId() ?? undefined,
    };
  });

  inicializar(): void {
    if (this.periodoComDados()) return;
    this.sismos.periodo().subscribe({
      next: (periodo) => {
        if (!periodo.inicio || !periodo.fim) return;
        const dia = (iso: string) => {
          const [a, m, d] = iso.slice(0, 10).split('-').map(Number);
          return new Date(a, m - 1, d);
        };
        const inicio = dia(periodo.inicio);
        this.periodoComDados.set({ inicio, fim: dia(periodo.fim) });
        this.limites.set({ min: inicio, max: hoje() });
      },
      error: () => undefined,
    });
  }

  definirRegiao(codigo: string | null) {
    this.regiao.set(codigo);
  }

  // Volta ao periodo padrao (ultimos 30 dias ate hoje)
  restaurarPeriodo() {
    this.inicio.set(diasAntes(hoje(), DIAS_PERIODO_PADRAO));
    this.fim.set(hoje());
  }

  definirPeriodo(inicio: Date | null, fim: Date | null) {
    this.inicio.set(inicio);
    this.fim.set(fim);
  }
}
