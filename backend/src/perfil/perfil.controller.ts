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
import { Throttle } from '@nestjs/throttler';
import { Response } from 'express';
import { memoryStorage } from 'multer';
import { UsuarioAtual, UsuarioLogado } from '../auth/decoradores';
import { AlterarSenhaDto } from './dto/alterar-senha.dto';
import { AtualizarPerfilDto } from './dto/atualizar-perfil.dto';
import { PerfilService } from './perfil.service';

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

// Toda rota daqui age somente sobre o usuario do token (nunca recebe um id).
@Controller('perfil')
export class PerfilController {
  constructor(private readonly perfilService: PerfilService) {}

  @Get()
  obter(@UsuarioAtual() usuario: UsuarioLogado) {
    return this.perfilService.obter(usuario.id);
  }

  @Put()
  atualizar(@UsuarioAtual() usuario: UsuarioLogado, @Body() dto: AtualizarPerfilDto) {
    return this.perfilService.atualizar(usuario.id, dto);
  }

  // Limite rigido: senha atual errada em serie e tentativa de forca bruta.
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @HttpCode(204)
  @Put('senha')
  alterarSenha(@UsuarioAtual() usuario: UsuarioLogado, @Body() dto: AlterarSenhaDto) {
    return this.perfilService.alterarSenha(usuario.id, dto);
  }

  // ---- Avatar ----

  @HttpCode(204)
  @UseInterceptors(uploadAvatar)
  @Put('avatar')
  async trocarAvatar(@UsuarioAtual() usuario: UsuarioLogado, @UploadedFile() arquivo?: Express.Multer.File) {
    if (!arquivo) throw new BadRequestException('Envie uma imagem no campo "arquivo".');
    await this.perfilService.trocarAvatar(usuario.id, arquivo.buffer);
  }

  @HttpCode(204)
  @Delete('avatar')
  removerAvatar(@UsuarioAtual() usuario: UsuarioLogado) {
    return this.perfilService.removerAvatar(usuario.id);
  }

  @Get('avatar')
  async avatar(@UsuarioAtual() usuario: UsuarioLogado, @Res({ passthrough: true }) res: Response) {
    const { fluxo, mime } = await this.perfilService.abrirAvatar(usuario.id);
    res.set({ 'Content-Type': mime, 'Cache-Control': 'private, no-cache' });
    return new StreamableFile(fluxo);
  }

  // ---- Acervo ----

  @Get('acervo')
  listarAcervo(@UsuarioAtual() usuario: UsuarioLogado) {
    return this.perfilService.listarAcervo(usuario.id);
  }

  @HttpCode(204)
  @UseInterceptors(uploadAcervo)
  @Post('acervo')
  async adicionar(@UsuarioAtual() usuario: UsuarioLogado, @UploadedFiles() arquivos?: Express.Multer.File[]) {
    if (!arquivos?.length) throw new BadRequestException('Envie ao menos uma imagem no campo "arquivos".');
    await this.perfilService.adicionarAoAcervo(usuario.id, arquivos);
  }

  // ?baixar=1 forca o download; sem ele a imagem e exibida na pagina.
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

  @HttpCode(204)
  @Delete('acervo/:id')
  removerImagem(@UsuarioAtual() usuario: UsuarioLogado, @Param('id', ParseIntPipe) id: number) {
    return this.perfilService.removerImagem(usuario.id, id);
  }
}
