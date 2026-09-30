import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, of, timeout } from 'rxjs';

export interface EnderecoViaCep {
  logradouro: string;
  bairro: string;
  cidade: string;
  uf: string;
}

interface RespostaViaCep {
  erro?: boolean | string;
  logradouro: string;
  bairro: string;
  localidade: string;
  uf: string;
}

// Resultado da busca: encontrado, CEP inexistente ou servico fora do ar.
export type ResultadoCep =
  | { situacao: 'ok'; endereco: EnderecoViaCep }
  | { situacao: 'nao-encontrado' }
  | { situacao: 'indisponivel' };

@Injectable({ providedIn: 'root' })
export class ViaCepServico {
  private readonly http = inject(HttpClient);

  // Recebe o CEP so com digitos (8).
  buscar(cep: string): Observable<ResultadoCep> {
    return this.http.get<RespostaViaCep>(`https://viacep.com.br/ws/${cep}/json/`).pipe(
      timeout(8000),
      map((r): ResultadoCep =>
        r.erro
          ? { situacao: 'nao-encontrado' }
          : {
              situacao: 'ok',
              endereco: { logradouro: r.logradouro, bairro: r.bairro, cidade: r.localidade, uf: r.uf },
            },
      ),
      // O ViaCEP responde 400 para CEP mal formado e some do ar de vez em quando.
      catchError((): Observable<ResultadoCep> => of({ situacao: 'indisponivel' })),
    );
  }
}
