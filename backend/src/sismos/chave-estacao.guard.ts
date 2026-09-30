import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { hashDaChave } from './estacoes.service';

// RN-09: a ingestao e autenticada pela chave da estacao (header x-chave-estacao),
// e nao pelo login de usuario. So o hash da chave existe no banco.
@Injectable()
export class ChaveEstacaoGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(contexto: ExecutionContext): Promise<boolean> {
    const requisicao = contexto.switchToHttp().getRequest();
    const chave = requisicao.headers['x-chave-estacao'];
    if (typeof chave !== 'string' || chave.length < 10 || chave.length > 200) {
      throw new UnauthorizedException('Chave da estação não informada.');
    }

    const estacao = await this.prisma.estacao.findUnique({ where: { chaveHash: hashDaChave(chave) } });
    if (!estacao) throw new UnauthorizedException('Chave da estação inválida.');
    // RN-05: estacao inativa nao recebe leituras.
    if (!estacao.ativa) throw new ForbiddenException('Esta estação está inativa e não recebe leituras.');

    requisicao.estacao = estacao;
    return true;
  }
}
