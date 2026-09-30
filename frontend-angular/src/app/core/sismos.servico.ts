import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import {
  AlertaDetalhe,
  DiaSismos,
  EstadoAlerta,
  FiltrosSismos,
  NivelAlerta,
  PaginaAlertas,
  PaginaEventos,
  PeriodoDisponivel,
  PontoMapa,
  RespostaRegioes,
  TotaisSismos,
} from './modelos';

export interface FiltrosAlertas {
  estado?: EstadoAlerta;
  nivel?: NivelAlerta;
  tipo?: 'SISMO' | 'SEM_COMUNICACAO';
}

function parametros(valores: object): HttpParams {
  let params = new HttpParams();
  for (const [chave, valor] of Object.entries(valores)) {
    if (valor !== undefined && valor !== null && valor !== '') params = params.set(chave, String(valor));
  }
  return params;
}

// Unico ponto de acesso aos endpoints de sismos (/api/eventos) e alertas (/api/alertas).
@Injectable({ providedIn: 'root' })
export class SismosServico {
  private readonly http = inject(HttpClient);

  periodo() {
    return this.http.get<PeriodoDisponivel>('/api/eventos/periodo');
  }

  eventos(filtros: FiltrosSismos, pagina: number, limite: number) {
    return this.http.get<PaginaEventos>('/api/eventos', { params: parametros({ ...filtros, pagina, limite }) });
  }

  totais(filtros: FiltrosSismos) {
    return this.http.get<TotaisSismos>('/api/eventos/totais', { params: parametros(filtros) });
  }

  serieDiaria(filtros: FiltrosSismos) {
    return this.http.get<DiaSismos[]>('/api/eventos/serie-diaria', { params: parametros(filtros) });
  }

  mapa(filtros: FiltrosSismos) {
    return this.http.get<PontoMapa[]>('/api/eventos/mapa', { params: parametros(filtros) });
  }

  // Quantos sismos em cada regiao do mundo (pinta o mapa-mundi)
  regioes(filtros: FiltrosSismos) {
    return this.http.get<RespostaRegioes>('/api/eventos/regioes', { params: parametros(filtros) });
  }

  sincronizar() {
    return this.http.post<{ recebidos: number; novos: number; atualizados: number }>('/api/eventos/sincronizar', {});
  }

  alertas(filtros: FiltrosAlertas, pagina: number, limite: number) {
    return this.http.get<PaginaAlertas>('/api/alertas', { params: parametros({ ...filtros, pagina, limite }) });
  }

  alerta(id: number) {
    return this.http.get<AlertaDetalhe>(`/api/alertas/${id}`);
  }

  reconhecer(id: number) {
    return this.http.put<AlertaDetalhe>(`/api/alertas/${id}/reconhecer`, {});
  }

  encerrar(id: number, motivo?: string) {
    return this.http.put<AlertaDetalhe>(`/api/alertas/${id}/encerrar`, { motivo });
  }
}
