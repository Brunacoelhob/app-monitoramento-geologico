import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { map, tap } from 'rxjs';
import { salvarArquivo } from './arquivo';
import { FormatoRelatorio } from './modelos';

export type ModuloRelatorio = 'temperatura' | 'sismos';
// Qualquer consulta com periodo; os demais filtros seguem como parametros da URL.
export type ConsultaRelatorio = { inicio: string; fim: string };

@Injectable({ providedIn: 'root' })
export class RelatorioServico {
  private readonly http = inject(HttpClient);

  // Pede o relatorio ao backend (com os filtros atuais) e baixa o arquivo.
  baixar(formato: FormatoRelatorio, consulta: ConsultaRelatorio, modulo: ModuloRelatorio = 'temperatura') {
    let params = new HttpParams().set('formato', formato);
    for (const [chave, valor] of Object.entries(consulta as Record<string, unknown>)) {
      if (valor !== undefined && valor !== '') params = params.set(chave, String(valor));
    }
    const prefixo = modulo === 'sismos' ? 'relatorio-sismos' : 'relatorio-temperaturas';
    const url = modulo === 'sismos' ? '/api/eventos/relatorio' : '/api/leituras/relatorio';
    const nome = `${prefixo}_${consulta.inicio}_a_${consulta.fim}.${formato}`;

    return this.http.get(url, { params, responseType: 'blob' }).pipe(
      tap((arquivo) => salvarArquivo(arquivo, nome)),
      map(() => undefined),
    );
  }
}
