import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { AuthServico } from './auth.servico';

// Anexa o JWT nas chamadas a /api e derruba a sessao se o backend responder 401.
export const interceptorAuth: HttpInterceptorFn = (requisicao, proximo) => {
  const auth = inject(AuthServico);
  const token = auth.token();
  const ehApi = requisicao.url.startsWith('/api');
  const ehLogin = requisicao.url.endsWith('/auth/login');

  const requisicaoFinal =
    token && ehApi && !ehLogin
      ? requisicao.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
      : requisicao;

  return proximo(requisicaoFinal).pipe(
    catchError((erro: unknown) => {
      if (erro instanceof HttpErrorResponse && erro.status === 401 && !ehLogin) {
        auth.sair();
      }
      return throwError(() => erro);
    }),
  );
};
