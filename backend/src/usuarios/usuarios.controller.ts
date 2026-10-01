import { Body, Controller, Delete, Get, HttpCode, Param, ParseIntPipe, Post, Put } from '@nestjs/common';
import { Papel } from '@prisma/client';
import { ApiCreatedResponse, ApiNoContentResponse, ApiOkResponse, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { Papeis, UsuarioAtual, UsuarioLogado } from '../auth/decoradores';
import { UsuarioListaResposta } from '../comum/respostas.dto';
import { Autenticada, Conflito, Invalida, NaoEncontrada, SomenteAdmin, TAGS } from '../comum/swagger';
import { AlterarPapelDto, CriarUsuarioDto } from './dto/usuarios.dto';
import { UsuariosService } from './usuarios.service';

const ID_USUARIO = { name: 'id', description: 'Id do usuário (veja em GET /usuarios).', example: 2 };

@ApiTags(TAGS.usuarios)
@Autenticada()
@SomenteAdmin()
@Papeis(Papel.ADMIN)
@Controller('usuarios')
export class UsuariosController {
  constructor(private readonly usuarios: UsuariosService) {}

  @ApiOperation({
    summary: 'Listar usuários',
    description: '**Somente ADMIN.** Todas as contas, sem dados sensíveis (nunca devolve senha nem CPF).',
  })
  @ApiOkResponse({ description: 'Lista de usuários.', type: [UsuarioListaResposta] })
  @Get()
  listar() {
    return this.usuarios.listar();
  }

  @ApiOperation({
    summary: 'Criar usuário',
    description:
      '**Somente ADMIN.** Cria uma conta com e-mail, senha inicial e papel. Não existe cadastro público: só o administrador cria contas. ' +
      'Passe a senha inicial por um canal seguro; a pessoa pode trocá-la depois em **Perfil**.',
  })
  @ApiCreatedResponse({ description: 'Usuário criado.', type: UsuarioListaResposta })
  @Invalida('E-mail inválido ou senha fraca (mínimo 10 caracteres, com letra e número).')
  @Conflito('Já existe um usuário com este e-mail.')
  @Post()
  criar(@Body() dto: CriarUsuarioDto) {
    return this.usuarios.criar(dto);
  }

  @ApiOperation({
    summary: 'Alterar papel',
    description:
      '**Somente ADMIN.** Promove a ADMIN ou rebaixa a VISUALIZADOR. Não é possível alterar o próprio papel. ' +
      'A mudança vale no próximo login da pessoa (o token atual dela segue com o papel antigo até expirar).',
  })
  @ApiParam(ID_USUARIO)
  @ApiOkResponse({ description: 'Usuário com o novo papel.', type: UsuarioListaResposta })
  @Invalida('O id não é um número, o papel é inválido ou você tentou alterar o próprio papel.')
  @NaoEncontrada('Usuário não encontrado.')
  @Put(':id/papel')
  alterarPapel(@Param('id', ParseIntPipe) id: number, @Body() dto: AlterarPapelDto, @UsuarioAtual() admin: UsuarioLogado) {
    return this.usuarios.alterarPapel(id, dto.papel, admin.id);
  }

  @ApiOperation({
    summary: 'Remover usuário',
    description:
      '**Somente ADMIN.** Apaga a conta, o avatar e o acervo de imagens da pessoa. Não é possível remover a própria conta. ' +
      'Ação irreversível.',
  })
  @ApiParam(ID_USUARIO)
  @ApiNoContentResponse({ description: 'Usuário removido.' })
  @Invalida('O id não é um número ou você tentou remover a própria conta.')
  @NaoEncontrada('Usuário não encontrado.')
  @HttpCode(204)
  @Delete(':id')
  remover(@Param('id', ParseIntPipe) id: number, @UsuarioAtual() admin: UsuarioLogado) {
    return this.usuarios.remover(id, admin.id);
  }
}
