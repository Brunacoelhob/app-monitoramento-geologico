import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { CHAVE_PUBLICA } from './decoradores';

// Guard global: exige token valido em toda rota que nao for @Publica().
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
  ) {}

  async canActivate(contexto: ExecutionContext): Promise<boolean> {
    const rotaPublica = this.reflector.getAllAndOverride<boolean>(CHAVE_PUBLICA, [
      contexto.getHandler(),
      contexto.getClass(),
    ]);
    if (rotaPublica) return true;

    const requisicao = contexto.switchToHttp().getRequest();
    const [tipo, token] = (requisicao.headers.authorization ?? '').split(' ');
    if (tipo !== 'Bearer' || !token) {
      throw new UnauthorizedException('Token nao informado.');
    }

    try {
      const dados = await this.jwt.verifyAsync(token);
      requisicao.usuario = { id: dados.sub, email: dados.email, papel: dados.papel };
      return true;
    } catch {
      throw new UnauthorizedException('Token invalido ou expirado.');
    }
  }
}
