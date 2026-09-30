import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { ArmazenamentoService } from './armazenamento.service';
import { AlterarSenhaDto } from './dto/alterar-senha.dto';
import { AtualizarPerfilDto } from './dto/atualizar-perfil.dto';

export const MAX_IMAGENS_ACERVO = 50;

@Injectable()
export class PerfilService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly armazenamento: ArmazenamentoService,
  ) {}

  // Nunca devolve senhaHash nem o nome do arquivo em disco.
  private async buscarUsuario(id: number) {
    const usuario = await this.prisma.usuario.findUnique({ where: { id } });
    if (!usuario) throw new NotFoundException('Usuario nao encontrado.');
    return usuario;
  }

  async obter(id: number) {
    const u = await this.buscarUsuario(id);
    return {
      email: u.email,
      papel: u.papel,
      criadoEm: u.criadoEm,
      nome: u.nome,
      cpf: u.cpf,
      celular: u.celular,
      cep: u.cep,
      logradouro: u.logradouro,
      numero: u.numero,
      complemento: u.complemento,
      bairro: u.bairro,
      cidade: u.cidade,
      uf: u.uf,
      temAvatar: !!u.avatarArquivo,
      // Perfil completo = todos os campos obrigatorios preenchidos.
      completo: !!(u.nome && u.cpf && u.celular && u.cep && u.logradouro && u.numero && u.bairro && u.cidade && u.uf),
    };
  }

  async atualizar(id: number, dto: AtualizarPerfilDto) {
    try {
      await this.prisma.usuario.update({
        where: { id },
        data: { ...dto, complemento: dto.complemento || null },
      });
    } catch (erro) {
      if (erro instanceof Prisma.PrismaClientKnownRequestError && erro.code === 'P2002') {
        throw new ConflictException('Este CPF ja esta cadastrado em outra conta.');
      }
      throw erro;
    }
    return this.obter(id);
  }

  async alterarSenha(id: number, dto: AlterarSenhaDto) {
    const usuario = await this.buscarUsuario(id);
    if (!(await bcrypt.compare(dto.senhaAtual, usuario.senhaHash))) {
      // 422 (e nao 401): o front trata 401 como sessao expirada e deslogaria o usuario.
      throw new UnprocessableEntityException('Senha atual incorreta.');
    }
    if (dto.senhaAtual === dto.novaSenha) {
      throw new BadRequestException('A nova senha precisa ser diferente da atual.');
    }
    await this.prisma.usuario.update({
      where: { id },
      data: { senhaHash: await bcrypt.hash(dto.novaSenha, 10) },
    });
  }

  // ---- Avatar ----

  async trocarAvatar(id: number, buffer: Buffer) {
    const usuario = await this.buscarUsuario(id);
    const salvo = await this.armazenamento.salvar(buffer);
    await this.prisma.usuario.update({
      where: { id },
      data: { avatarArquivo: salvo.arquivo, avatarMime: salvo.mime },
    });
    await this.armazenamento.remover(usuario.avatarArquivo);
  }

  async removerAvatar(id: number) {
    const usuario = await this.buscarUsuario(id);
    await this.prisma.usuario.update({
      where: { id },
      data: { avatarArquivo: null, avatarMime: null },
    });
    await this.armazenamento.remover(usuario.avatarArquivo);
  }

  async abrirAvatar(id: number) {
    const usuario = await this.buscarUsuario(id);
    const fluxo = usuario.avatarArquivo ? this.armazenamento.abrir(usuario.avatarArquivo) : null;
    if (!fluxo || !usuario.avatarMime) throw new NotFoundException('Sem avatar.');
    return { fluxo, mime: usuario.avatarMime };
  }

  // ---- Acervo ----

  listarAcervo(usuarioId: number) {
    return this.prisma.imagem.findMany({
      where: { usuarioId },
      orderBy: { criadaEm: 'desc' },
      select: { id: true, nomeOriginal: true, mime: true, tamanho: true, criadaEm: true },
    });
  }

  async adicionarAoAcervo(usuarioId: number, arquivos: Express.Multer.File[]) {
    const existentes = await this.prisma.imagem.count({ where: { usuarioId } });
    if (existentes + arquivos.length > MAX_IMAGENS_ACERVO) {
      throw new BadRequestException(`O acervo aceita no maximo ${MAX_IMAGENS_ACERVO} imagens.`);
    }

    // Valida todas antes de gravar qualquer uma (tudo ou nada).
    const salvas: { arquivo: Awaited<ReturnType<ArmazenamentoService['salvar']>>; nome: string }[] = [];
    try {
      for (const arquivo of arquivos) {
        salvas.push({ arquivo: await this.armazenamento.salvar(arquivo.buffer), nome: arquivo.originalname });
      }
    } catch (erro) {
      await Promise.all(salvas.map((s) => this.armazenamento.remover(s.arquivo.arquivo)));
      throw erro;
    }

    await this.prisma.imagem.createMany({
      data: salvas.map(({ arquivo, nome }) => ({
        usuarioId,
        // Multer entrega o nome em latin1; converte para UTF-8 e tira caminhos.
        nomeOriginal: Buffer.from(nome, 'latin1').toString('utf8').split(/[\\/]/).pop()!.slice(0, 120),
        arquivo: arquivo.arquivo,
        mime: arquivo.mime,
        tamanho: arquivo.tamanho,
      })),
    });
  }

  // Filtra por usuarioId: ninguem alcanca a imagem de outro usuario.
  async abrirImagem(usuarioId: number, imagemId: number) {
    const imagem = await this.prisma.imagem.findFirst({ where: { id: imagemId, usuarioId } });
    const fluxo = imagem ? this.armazenamento.abrir(imagem.arquivo) : null;
    if (!imagem || !fluxo) throw new NotFoundException('Imagem nao encontrada.');
    return { fluxo, mime: imagem.mime, nomeOriginal: imagem.nomeOriginal };
  }

  async removerImagem(usuarioId: number, imagemId: number) {
    const imagem = await this.prisma.imagem.findFirst({ where: { id: imagemId, usuarioId } });
    if (!imagem) throw new NotFoundException('Imagem nao encontrada.');
    await this.prisma.imagem.delete({ where: { id: imagem.id } });
    await this.armazenamento.remover(imagem.arquivo);
  }
}
