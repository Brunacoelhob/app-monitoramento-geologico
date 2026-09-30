import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Papel } from '@prisma/client';
import { CHAVE_PAPEIS } from './decoradores';

// Guard global de autorizacao: confere o papel quando a rota usa @Papeis().
@Injectable()
export class PapeisGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(contexto: ExecutionContext): boolean {
    const permitidos = this.reflector.getAllAndOverride<Papel[]>(CHAVE_PAPEIS, [
      contexto.getHandler(),
      contexto.getClass(),
    ]);
    if (!permitidos || permitidos.length === 0) return true;

    const { usuario } = contexto.switchToHttp().getRequest();
    if (!usuario || !permitidos.includes(usuario.papel)) {
      throw new ForbiddenException('Voce nao tem permissao para esta acao.');
    }
    return true;
  }
}
