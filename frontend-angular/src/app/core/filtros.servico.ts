import { Injectable, computed, inject, signal } from '@angular/core';
import { LeiturasServico } from './leituras.servico';
import { Consulta, Origem, Sentido } from './modelos';

export const TODOS_SENTIDOS: Sentido[] = ['INTERNO', 'EXTERNO'];

// Janela inicial do painel: os ultimos 30 dias ate hoje.
export const DIAS_PERIODO_PADRAO = 30;

// AAAA-MM-DD no fuso local (toISOString usaria UTC e poderia mudar o dia).
export function paraDataApi(data: Date): string {
  const mes = String(data.getMonth() + 1).padStart(2, '0');
  const dia = String(data.getDate()).padStart(2, '0');
  return `${data.getFullYear()}-${mes}-${dia}`;
}

export function hoje(): Date {
  const agora = new Date();
  return new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());
}

export function diasAntes(data: Date, dias: number): Date {
  return new Date(data.getFullYear(), data.getMonth(), data.getDate() - dias);
}

// A API entrega datas em UTC; aqui elas viram Date local com o mesmo dia,
// para o datepicker mostrar o dia certo.
function dataDoDia(iso: string): Date {
  const [ano, mes, dia] = iso.slice(0, 10).split('-').map(Number);
  return new Date(ano, mes - 1, dia);
}

// Estado dos filtros, compartilhado entre Painel e Leituras.
@Injectable({ providedIn: 'root' })
export class FiltrosServico {
  private readonly leituras = inject(LeiturasServico);

  // Comeca ja com o periodo padrao, entao o painel carrega sem esperar a API.
  readonly inicio = signal<Date | null>(diasAntes(hoje(), DIAS_PERIODO_PADRAO));
  readonly fim = signal<Date | null>(hoje());
  readonly sentidos = signal<Sentido[]>(TODOS_SENTIDOS);
  // Null = todas. Permite separar dados reais dos simulados e escolher a estacao.
  readonly origem = signal<Origem | null>(null);
  readonly estacaoId = signal<number | null>(null);

  // Limites do calendario: da primeira leitura do banco ate hoje.
  readonly limites = signal<{ min: Date; max: Date } | null>(null);
  // Intervalo em que existem leituras (para o atalho quando o periodo vem vazio).
  readonly periodoComDados = signal<{ inicio: Date; fim: Date } | null>(null);
  readonly semDados = signal(false);
  readonly erro = signal(false);

  // null enquanto o periodo estiver incompleto ou sem sentido marcado.
  readonly consulta = computed<Consulta | null>(() => {
    const inicio = this.inicio();
    const fim = this.fim();
    const sentidos = this.sentidos();
    if (!inicio || !fim || sentidos.length === 0) return null;
    return {
      inicio: paraDataApi(inicio),
      fim: paraDataApi(fim),
      // Os dois sentidos marcados = sem filtro de sentido.
      sentido: sentidos.length === 1 ? sentidos[0] : undefined,
      estacaoId: this.estacaoId() ?? undefined,
      origem: this.origem() ?? undefined,
    };
  });

  // Descobre o intervalo disponivel no banco (nao altera o periodo escolhido).
  inicializar(): void {
    if (this.periodoComDados() || this.semDados()) return;
    this.leituras.periodo().subscribe({
      next: (periodo) => {
        if (!periodo.inicio || !periodo.fim) {
          this.semDados.set(true);
          return;
        }
        const inicio = dataDoDia(periodo.inicio);
        const fim = dataDoDia(periodo.fim);
        this.periodoComDados.set({ inicio, fim });
        this.limites.set({ min: inicio, max: hoje() });
      },
      error: () => this.erro.set(true),
    });
  }

  // Atalho: leva o filtro para os 30 dias mais recentes que tem leituras.
  irParaUltimosDadosDisponiveis(): void {
    const dados = this.periodoComDados();
    if (!dados) return;
    const inicio = diasAntes(dados.fim, DIAS_PERIODO_PADRAO);
    this.definirPeriodo(inicio > dados.inicio ? inicio : dados.inicio, dados.fim);
  }

  definirPeriodo(inicio: Date | null, fim: Date | null): void {
    this.inicio.set(inicio);
    this.fim.set(fim);
  }

  definirSentidos(sentidos: Sentido[]): void {
    this.sentidos.set(sentidos);
  }

  definirOrigem(origem: Origem | null): void {
    this.origem.set(origem);
  }

  definirEstacao(id: number | null): void {
    this.estacaoId.set(id);
  }
}
