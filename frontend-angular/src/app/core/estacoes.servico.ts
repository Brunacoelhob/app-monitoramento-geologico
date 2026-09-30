import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { tap } from 'rxjs';
import { Estacao, SeriesEstacao, TipoSensor, Sentido } from './modelos';

export interface NovaEstacao {
  codigo: string;
  nome: string;
  latitude?: number;
  longitude?: number;
  placa?: string;
  origem: 'REAL' | 'SIMULADO';
  sensores: { tipo: TipoSensor; nome: string; sentido?: Sentido }[];
}

// Estacoes (temperatura, sismografo e GPS) e as series de cada uma.
@Injectable({ providedIn: 'root' })
export class EstacoesServico {
  private readonly http = inject(HttpClient);
  readonly estacoes = signal<Estacao[]>([]);

  carregar() {
    return this.http.get<Estacao[]>('/api/estacoes').pipe(tap((lista) => this.estacoes.set(lista)));
  }

  series(id: number, horas: number) {
    return this.http.get<SeriesEstacao>(`/api/estacoes/${id}/series`, { params: { horas } });
  }

  // So o admin. A chave de API aparece uma unica vez, na resposta.
  criar(dados: NovaEstacao) {
    return this.http.post<Estacao & { chave: string }>('/api/estacoes', dados).pipe(tap(() => this.carregar().subscribe()));
  }

  definirSituacao(id: number, ativa: boolean) {
    return this.http.put<Estacao>(`/api/estacoes/${id}/situacao`, { ativa }).pipe(tap(() => this.carregar().subscribe()));
  }

  novaChave(id: number) {
    return this.http.post<{ chave: string }>(`/api/estacoes/${id}/chave`, {});
  }
}
