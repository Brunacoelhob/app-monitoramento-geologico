import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';

// Hash falso usado quando o email nao existe, para o tempo de resposta
// ser parecido e nao revelar quais emails estao cadastrados.
const HASH_FALSO = bcrypt.hashSync('senha-falsa', 10);

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async login({ email, senha }: LoginDto) {
    const usuario = await this.prisma.usuario.findUnique({
      where: { email: email.toLowerCase() },
    });

    const senhaValida = await bcrypt.compare(senha, usuario?.senhaHash ?? HASH_FALSO);
    if (!usuario || !senhaValida) {
      // Mesma mensagem para email ou senha errados.
      throw new UnauthorizedException('Email ou senha invalidos.');
    }

    const token = await this.jwt.signAsync({
      sub: usuario.id,
      email: usuario.email,
      papel: usuario.papel,
    });

    return { token, usuario: { email: usuario.email, papel: usuario.papel } };
  }
}
