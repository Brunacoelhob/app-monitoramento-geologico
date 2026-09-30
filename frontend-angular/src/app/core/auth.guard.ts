import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthServico } from './auth.servico';

// Bloqueia rotas privadas (a autorizacao de verdade continua no backend).
export const guardaAutenticado: CanActivateFn = () => {
  const auth = inject(AuthServico);
  return auth.autenticado() ? true : inject(Router).createUrlTree(['/login']);
};

// Quem ja esta logado nao precisa ver a tela de login.
export const guardaVisitante: CanActivateFn = () => {
  const auth = inject(AuthServico);
  return auth.autenticado() ? inject(Router).createUrlTree(['/inicio']) : true;
};
