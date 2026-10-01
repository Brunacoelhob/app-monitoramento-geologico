import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { filter } from 'rxjs';
import { AuthServico } from './auth.servico';
import { AlertaResumo, NivelAlerta } from './modelos';
import { SismosServico } from './sismos.servico';
import { TempoRealServico } from './tempo-real.servico';

const CHAVE = 'iot.alarmes.dispensados';
const INTERVALO_MS = 60_000;
const PESO: Record<NivelAlerta, number> = { ATENCAO: 1, ALTO: 2, CRITICO: 3 };

function lerDispensados(): number[] {
  try {
    const bruto = JSON.parse(localStorage.getItem(CHAVE) ?? '[]');
    return Array.isArray(bruto) ? bruto.filter((n) => typeof n === 'number') : [];
  } catch {
    return [];
  }
}

// Alarme em tela cheia: busca os alertas de sismo abertos (ALTO e CRITICO) a cada minuto e mostra o
// mais grave que o usuario ainda nao dispensou. Dispensar so esconde o aviso: o alerta segue aberto.
@Injectable({ providedIn: 'root' })
export class AlarmeServico {
  private readonly auth = inject(AuthServico);
  private readonly sismos = inject(SismosServico);
  private readonly tempoReal = inject(TempoRealServico);

  private readonly abertos = signal<AlertaResumo[]>([]);
  private readonly dispensados = signal<number[]>(lerDispensados());

  // Pre-visualizacao (botao do admin): um alerta ficticio que nunca vai para a API
  readonly previa = signal<AlertaResumo | null>(null);

  readonly atual = computed(() => {
    const previa = this.previa();
    if (previa) return previa;
    const dispensados = this.dispensados();
    return (
      [...this.abertos()]
        .filter((a) => !dispensados.includes(a.id))
        .sort((a, b) => PESO[b.nivel] - PESO[a.nivel] || b.abertoEm.localeCompare(a.abertoEm))[0] ?? null
    );
  });

  constructor() {
    // Tempo real: um alerta novo acende a luz na hora (a busca a cada minuto fica como reserva)
    this.tempoReal.avisos$
      .pipe(filter((aviso) => aviso.tipo === 'alerta'), takeUntilDestroyed())
      .subscribe(() => {
        if (this.auth.autenticado()) this.buscar();
      });

    effect((limpar) => {
      if (!this.auth.autenticado()) {
        this.abertos.set([]);
        return;
      }
      this.buscar();
      const temporizador = setInterval(() => this.buscar(), INTERVALO_MS);
      limpar(() => clearInterval(temporizador));
    });
  }

  private buscar() {
    this.sismos.alertas({ estado: 'ABERTO', tipo: 'SISMO' }, 1, 50).subscribe({
      next: (pagina) => this.abertos.set(pagina.itens.filter((a) => a.nivel === 'ALTO' || a.nivel === 'CRITICO')),
      error: () => undefined, // sem rede: tenta de novo no proximo ciclo
    });
  }

  dispensar() {
    if (this.previa()) return this.previa.set(null);
    const atual = this.atual();
    if (!atual) return;
    const lista = [...this.dispensados(), atual.id].slice(-200);
    this.dispensados.set(lista);
    try {
      localStorage.setItem(CHAVE, JSON.stringify(lista));
    } catch {
      // sem storage: o aviso volta ao recarregar a pagina
    }
  }

  previsualizar(nivel: 'ALTO' | 'CRITICO') {
    const agora = new Date().toISOString();
    const critico = nivel === 'CRITICO';
    this.previa.set({
      id: -1,
      tipo: 'SISMO',
      nivel,
      nivelAnterior: null,
      estado: 'ABERTO',
      titulo: critico ? 'M6,8 - 60 km E of Ishinomaki, Japan' : 'M5,9 - 48 km E of Ishinomaki, Japan',
      abertoEm: agora,
      encerradoEm: null,
      encerradoAutomatico: false,
      motivoEncerramento: null,
      evento: {
        magnitude: critico ? 6.8 : 5.9,
        profundidadeKm: 32,
        local: critico ? '60 km E of Ishinomaki, Japan' : '48 km E of Ishinomaki, Japan',
        ocorridoEm: agora,
        origem: 'SIMULADO',
      },
      estacao: null,
      _count: { replicas: 0 },
    });
  }
}
