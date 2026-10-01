import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
  Res,
  StreamableFile,
  UploadedFile,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import {
  ApiBody,
  ApiConsumes,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiPayloadTooLargeResponse,
  ApiProduces,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Response } from 'express';
import { memoryStorage } from 'multer';
import { UsuarioAtual, UsuarioLogado } from '../auth/decoradores';
import { ErroApi, ImagemAcervoResposta, PerfilResposta } from '../comum/respostas.dto';
import { Autenticada, Invalida, NaoEncontrada, Conflito, Recusada, TAGS } from '../comum/swagger';
import { AlterarSenhaDto } from './dto/alterar-senha.dto';
import { AtualizarPerfilDto } from './dto/atualizar-perfil.dto';
import { MAX_IMAGENS_ACERVO, PerfilService } from './perfil.service';

const MB = 1024 * 1024;

// Arquivo fica em memoria so ate o servico validar o tipo e gravar em disco.
const uploadAvatar = FileInterceptor('arquivo', {
  storage: memoryStorage(),
  limits: { fileSize: 2 * MB, files: 1 },
});
const uploadAcervo = FilesInterceptor('arquivos', 10, {
  storage: memoryStorage(),
  limits: { fileSize: 5 * MB, files: 10 },
});

// Corpos multipart: o Swagger precisa saber que o campo e um arquivo binario (aparece o botao "Escolher arquivo").
const corpoAvatar = {
  description: 'Imagem do avatar (multipart/form-data).',
  schema: {
    type: 'object',
    properties: {
      arquivo: { type: 'string', format: 'binary', description: 'Imagem JPG, PNG, GIF ou WEBP de até 2 MB. O tipo é conferido pelo conteúdo, não pela extensão.' },
    },
    required: ['arquivo'],
  },
};
const corpoAcervo = {
  description: 'Até 10 imagens por envio (multipart/form-data).',
  schema: {
    type: 'object',
    properties: {
      arquivos: {
        type: 'array',
        description: `Imagens JPG, PNG, GIF ou WEBP, até 5 MB cada, no máximo 10 por envio e ${MAX_IMAGENS_ACERVO} no acervo.`,
        items: { type: 'string', format: 'binary' },
      },
    },
    required: ['arquivos'],
  },
};

const ID_IMAGEM = { name: 'id', description: 'Id da imagem (veja em GET /perfil/acervo).', example: 7 };
const IMAGEM_BINARIA = {
  'image/jpeg': { schema: { type: 'string', format: 'binary' } },
  'image/png': { schema: { type: 'string', format: 'binary' } },
  'image/gif': { schema: { type: 'string', format: 'binary' } },
  'image/webp': { schema: { type: 'string', format: 'binary' } },
};

// Toda rota daqui age somente sobre o usuario do token (nunca recebe um id de usuario).
@ApiTags(TAGS.perfil)
@Autenticada()
@Controller('perfil')
export class PerfilController {
  constructor(private readonly perfilService: PerfilService) {}

  @ApiOperation({
    summary: 'Ver meu perfil',
    description: 'Dados pessoais e de endereço do usuário do token. `completo` indica se todos os campos obrigatórios estão preenchidos.',
  })
  @ApiOkResponse({ description: 'Perfil do usuário.', type: PerfilResposta })
  @NaoEncontrada('Usuário não encontrado.')
  @Get()
  obter(@UsuarioAtual() usuario: UsuarioLogado) {
    return this.perfilService.obter(usuario.id);
  }

  @ApiOperation({
    summary: 'Atualizar meu perfil',
    description:
      'Grava dados pessoais e de endereço. Todos os campos são obrigatórios, exceto `complemento`. ' +
      'CPF, celular e CEP podem vir com máscara (`529.982.247-25`); a API guarda só os dígitos.',
  })
  @ApiOkResponse({ description: 'Perfil atualizado.', type: PerfilResposta })
  @Invalida('Algum campo é inválido (CPF, celular, CEP, UF...). A lista `message` diz qual.')
  @Conflito('Este CPF já está cadastrado em outra conta.')
  @Put()
  atualizar(@UsuarioAtual() usuario: UsuarioLogado, @Body() dto: AtualizarPerfilDto) {
    return this.perfilService.atualizar(usuario.id, dto);
  }

  // Limite rigido: senha atual errada em serie e tentativa de forca bruta.
  @ApiOperation({
    summary: 'Alterar minha senha',
    description:
      'Exige a senha atual. A nova precisa ter 8 a 72 caracteres, com letra e número, e ser diferente da atual. ' +
      'Limite de **5 tentativas por minuto**.',
  })
  @ApiNoContentResponse({ description: 'Senha alterada (sem corpo na resposta).' })
  @Invalida('Nova senha fraca (menos de 8 caracteres, sem letra ou sem número) ou igual à atual.')
  @Recusada('Senha atual incorreta.')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @HttpCode(204)
  @Put('senha')
  alterarSenha(@UsuarioAtual() usuario: UsuarioLogado, @Body() dto: AlterarSenhaDto) {
    return this.perfilService.alterarSenha(usuario.id, dto);
  }

  // ---- Avatar ----

  @ApiOperation({
    summary: 'Enviar avatar (upload)',
    description:
      'Troca a foto do perfil. Envie **um arquivo** no campo `arquivo`: no Swagger aparece o botão **Choose File** ao clicar em *Try it out*. ' +
      'Formatos: JPG, PNG, GIF ou WEBP, **até 2 MB**. SVG não é aceito de propósito (pode carregar script).',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody(corpoAvatar)
  @ApiNoContentResponse({ description: 'Avatar salvo (o anterior é removido).' })
  @Invalida('Nenhum arquivo enviado no campo `arquivo`, ou o conteúdo não é uma imagem JPG/PNG/GIF/WEBP.')
  @ApiPayloadTooLargeResponse({ description: 'O arquivo passa de 2 MB.', type: ErroApi })
  @HttpCode(204)
  @UseInterceptors(uploadAvatar)
  @Put('avatar')
  async trocarAvatar(@UsuarioAtual() usuario: UsuarioLogado, @UploadedFile() arquivo?: Express.Multer.File) {
    if (!arquivo) throw new BadRequestException('Envie uma imagem no campo "arquivo".');
    await this.perfilService.trocarAvatar(usuario.id, arquivo.buffer);
  }

  @ApiOperation({ summary: 'Remover avatar', description: 'Apaga a foto do perfil. Se não havia avatar, também responde 204.' })
  @ApiNoContentResponse({ description: 'Avatar removido.' })
  @HttpCode(204)
  @Delete('avatar')
  removerAvatar(@UsuarioAtual() usuario: UsuarioLogado) {
    return this.perfilService.removerAvatar(usuario.id);
  }

  @ApiOperation({ summary: 'Baixar meu avatar', description: 'Devolve a imagem (arquivo binário). O Swagger mostra a prévia e o link **Download file**.' })
  @ApiProduces('image/jpeg', 'image/png', 'image/gif', 'image/webp')
  @ApiResponse({ status: 200, description: 'Imagem do avatar.', content: IMAGEM_BINARIA })
  @NaoEncontrada('O usuário ainda não enviou avatar.')
  @Get('avatar')
  async avatar(@UsuarioAtual() usuario: UsuarioLogado, @Res({ passthrough: true }) res: Response) {
    const { fluxo, mime } = await this.perfilService.abrirAvatar(usuario.id);
    res.set({ 'Content-Type': mime, 'Cache-Control': 'private, no-cache' });
    return new StreamableFile(fluxo);
  }

  // ---- Acervo ----

  @ApiOperation({ summary: 'Listar meu acervo', description: 'Metadados das imagens do acervo do usuário (não traz o arquivo; para isso use o link de arquivo).' })
  @ApiOkResponse({ description: 'Imagens do acervo.', type: [ImagemAcervoResposta] })
  @Get('acervo')
  listarAcervo(@UsuarioAtual() usuario: UsuarioLogado) {
    return this.perfilService.listarAcervo(usuario.id);
  }

  @ApiOperation({
    summary: 'Enviar imagens ao acervo (upload múltiplo)',
    description:
      `Adiciona imagens ao acervo. Envie **de 1 a 10 arquivos** no campo \`arquivos\` (no Swagger, **Add item** cria um botão de arquivo para cada imagem). ` +
      `Formatos: JPG, PNG, GIF ou WEBP, **até 5 MB cada**. O acervo guarda no máximo **${MAX_IMAGENS_ACERVO} imagens**.`,
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody(corpoAcervo)
  @ApiNoContentResponse({ description: 'Imagens adicionadas.' })
  @Invalida('Nenhum arquivo enviado, arquivo que não é imagem JPG/PNG/GIF/WEBP ou acervo cheio.')
  @ApiPayloadTooLargeResponse({ description: 'Algum arquivo passa de 5 MB.', type: ErroApi })
  @HttpCode(204)
  @UseInterceptors(uploadAcervo)
  @Post('acervo')
  async adicionar(@UsuarioAtual() usuario: UsuarioLogado, @UploadedFiles() arquivos?: Express.Multer.File[]) {
    if (!arquivos?.length) throw new BadRequestException('Envie ao menos uma imagem no campo "arquivos".');
    await this.perfilService.adicionarAoAcervo(usuario.id, arquivos);
  }

  // ?baixar=1 forca o download; sem ele a imagem e exibida na pagina.
  @ApiOperation({
    summary: 'Abrir ou baixar uma imagem do acervo',
    description: 'Devolve o arquivo da imagem. Com `baixar=1` o navegador baixa o arquivo; sem ele, exibe na página.',
  })
  @ApiParam(ID_IMAGEM)
  @ApiQuery({ name: 'baixar', required: false, description: 'Use `1` para forçar o download (Content-Disposition: attachment).', example: '1' })
  @ApiProduces('image/jpeg', 'image/png', 'image/gif', 'image/webp')
  @ApiResponse({ status: 200, description: 'Arquivo da imagem.', content: IMAGEM_BINARIA })
  @Invalida('O id não é um número inteiro.')
  @NaoEncontrada('Imagem não encontrada (ou não pertence ao usuário).')
  @Get('acervo/:id/arquivo')
  async arquivo(
    @UsuarioAtual() usuario: UsuarioLogado,
    @Param('id', ParseIntPipe) id: number,
    @Query('baixar') baixar: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { fluxo, mime, nomeOriginal } = await this.perfilService.abrirImagem(usuario.id, id);
    res.set({
      'Content-Type': mime,
      'Cache-Control': 'private, no-cache',
      'Content-Disposition': `${baixar ? 'attachment' : 'inline'}; filename*=UTF-8''${encodeURIComponent(nomeOriginal)}`,
    });
    return new StreamableFile(fluxo);
  }

  @ApiOperation({ summary: 'Remover imagem do acervo', description: 'Apaga a imagem e o arquivo em disco. Só é possível remover imagens do próprio usuário.' })
  @ApiParam(ID_IMAGEM)
  @ApiNoContentResponse({ description: 'Imagem removida.' })
  @Invalida('O id não é um número inteiro.')
  @NaoEncontrada('Imagem não encontrada (ou não pertence ao usuário).')
  @HttpCode(204)
  @Delete('acervo/:id')
  removerImagem(@UsuarioAtual() usuario: UsuarioLogado, @Param('id', ParseIntPipe) id: number) {
    return this.perfilService.removerImagem(usuario.id, id);
  }
}
