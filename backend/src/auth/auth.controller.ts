import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common';
import { ApiBadRequestResponse, ApiOkResponse, ApiOperation, ApiTags, ApiTooManyRequestsResponse, ApiUnauthorizedResponse } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { ErroApi, LoginResposta, UsuarioAutenticadoResposta } from '../comum/respostas.dto';
import { Autenticada, TAGS } from '../comum/swagger';
import { AuthService } from './auth.service';
import { Publica, UsuarioAtual, UsuarioLogado } from './decoradores';
import { LoginDto } from './dto/login.dto';

@ApiTags(TAGS.auth)
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // Limite rigido contra forca bruta: 5 tentativas por minuto por IP.
  @ApiOperation({
    summary: 'Entrar com e-mail e senha',
    description:
      'Devolve um **token JWT** e os dados básicos do usuário. Depois do login, o token é aplicado ao botão **Authorize** ' +
      'desta página automaticamente; fora daqui, envie-o no cabeçalho `Authorization: Bearer <token>`.\n\n' +
      '**Segurança:** e-mail inexistente e senha errada devolvem a mesma mensagem (não revela quais e-mails existem). ' +
      'Limite de **5 tentativas por minuto** por IP.',
  })
  @ApiOkResponse({ description: 'Login realizado.', type: LoginResposta })
  @ApiBadRequestResponse({ description: 'E-mail em formato inválido ou campos ausentes.', type: ErroApi })
  @ApiUnauthorizedResponse({ description: 'E-mail ou senha inválidos.', type: ErroApi })
  @ApiTooManyRequestsResponse({ description: 'Mais de 5 tentativas em 1 minuto. Aguarde.', type: ErroApi })
  @Publica()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @HttpCode(200)
  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @ApiOperation({
    summary: 'Quem sou eu',
    description: 'Devolve o usuário do token (id, e-mail e papel). Útil para testar se o token ainda é válido.',
  })
  @ApiOkResponse({ description: 'Usuário autenticado.', type: UsuarioAutenticadoResposta })
  @Autenticada()
  @Get('eu')
  eu(@UsuarioAtual() usuario: UsuarioLogado) {
    return usuario;
  }
}
