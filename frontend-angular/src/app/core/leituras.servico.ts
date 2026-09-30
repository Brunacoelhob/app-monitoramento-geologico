import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Consulta, PaginaLeituras, PeriodoDisponivel, PontoSerie, Totais } from './modelos';

// Unico ponto de acesso aos endpoints /api/leituras.
@Injectable({ providedIn: 'root' })
export class LeiturasServico {
  private readonly http = inject(HttpClient);

  periodo() {
    return this.http.get<PeriodoDisponivel>('/api/leituras/periodo');
  }

  totais(consulta: Consulta) {
    return this.http.get<Totais>('/api/leituras/totais', { params: this.params(consulta) });
  }

  serieHoraria(consulta: Consulta) {
    return this.http.get<PontoSerie[]>('/api/leituras/serie-horaria', {
      params: this.params(consulta),
    });
  }

  listar(consulta: Consulta, pagina: number, limite: number) {
    return this.http.get<PaginaLeituras>('/api/leituras', {
      params: this.params({ ...consulta, pagina, limite }),
    });
  }

  private params(valores: object): HttpParams {
    let params = new HttpParams();
    for (const [chave, valor] of Object.entries(valores)) {
      if (valor !== undefined && valor !== null) params = params.set(chave, String(valor));
    }
    return params;
  }
}
