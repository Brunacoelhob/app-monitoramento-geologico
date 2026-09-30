import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { Publica, UsuarioAtual, UsuarioLogado } from './decoradores';
import { LoginDto } from './dto/login.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // Limite rigido contra forca bruta: 5 tentativas por minuto por IP.
  @Publica()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @HttpCode(200)
  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Get('eu')
  eu(@UsuarioAtual() usuario: UsuarioLogado) {
    return usuario;
  }
}
