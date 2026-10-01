import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { salvarArquivo } from './arquivo';
import { Consulta, PaginaLeituras, PeriodoDisponivel, PontoSerie, Totais } from './modelos';

export interface ResultadoImportacao {
  linhasLidas: number;
  importadas: number;
  ignoradas: number;
  totalRejeitadas: number;
  rejeitadas: { linha: number; motivo: string }[];
}

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

  // Somente admin: o backend valida o arquivo linha a linha e devolve o que entrou e o que foi recusado
  importar(arquivo: File, estacaoId?: number) {
    const corpo = new FormData();
    corpo.append('arquivo', arquivo, arquivo.name);
    if (estacaoId) corpo.append('estacaoId', String(estacaoId));
    return this.http.post<ResultadoImportacao>('/api/leituras/importar', corpo);
  }

  baixarModelo(): void {
    this.http.get('/api/leituras/importar/modelo', { responseType: 'blob' }).subscribe((blob) => salvarArquivo(blob, 'modelo-importacao-leituras.csv'));
  }

  private params(valores: object): HttpParams {
    let params = new HttpParams();
    for (const [chave, valor] of Object.entries(valores)) {
      if (valor !== undefined && valor !== null) params = params.set(chave, String(valor));
    }
    return params;
  }
}
