import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AuthModule } from './auth/auth.module';
import { JwtAuthGuard } from './auth/jwt-auth.guard';
import { PapeisGuard } from './auth/papeis.guard';
import { validarVariaveis } from './config/variaveis';
import { LeiturasModule } from './leituras/leituras.module';
import { PerfilModule } from './perfil/perfil.module';
import { PrismaModule } from './prisma/prisma.module';
import { SaudeModule } from './saude/saude.module';
import { SismosModule } from './sismos/sismos.module';
import { TempoRealModule } from './tempo-real/tempo-real.module';
import { UsuariosModule } from './usuarios/usuarios.module';

@Module({
  imports: [
    // Le o .env da raiz do projeto (ou da pasta backend) e valida na partida.
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../.env'],
      validate: validarVariaveis,
    }),
    // Limite geral: 100 requisicoes por minuto por IP.
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
    PrismaModule,
    AuthModule,
    LeiturasModule,
    PerfilModule,
    SaudeModule,
    TempoRealModule,
    SismosModule,
    UsuariosModule,
  ],
  providers: [
    // A ordem importa: limite -> autenticacao -> autorizacao.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: PapeisGuard },
  ],
})
export class AppModule {}
