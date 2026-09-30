import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';
import { Papel } from '@prisma/client';

export const CHAVE_PUBLICA = 'rotaPublica';
export const CHAVE_PAPEIS = 'papeisPermitidos';

// Libera a rota sem token (por padrao TODAS as rotas exigem login).
export const Publica = () => SetMetadata(CHAVE_PUBLICA, true);

// Restringe a rota a determinados papeis.
export const Papeis = (...papeis: Papel[]) => SetMetadata(CHAVE_PAPEIS, papeis);

export interface UsuarioLogado {
  id: number;
  email: string;
  papel: Papel;
}

// Entrega o usuario autenticado (preenchido pelo JwtAuthGuard).
export const UsuarioAtual = createParamDecorator(
  (_dados: unknown, contexto: ExecutionContext): UsuarioLogado => {
    return contexto.switchToHttp().getRequest().usuario;
  },
);
