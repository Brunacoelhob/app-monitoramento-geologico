import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Papel, Prisma } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { ArmazenamentoService } from '../perfil/armazenamento.service';
import { PrismaService } from '../prisma/prisma.service';
import { CriarUsuarioDto } from './dto/usuarios.dto';

const SELECAO = { id: true, email: true, papel: true, nome: true, criadoEm: true, avatarArquivo: true } as const;

type Linha = Prisma.UsuarioGetPayload<{ select: typeof SELECAO }>;

// Nunca devolve hash de senha nem caminho de arquivo: so o que a tela de usuarios precisa.
const apresentar = ({ avatarArquivo, ...resto }: Linha) => ({ ...resto, temAvatar: avatarArquivo !== null });

// Gestao de usuarios pelo ADMIN. Nao existe cadastro publico: so o admin cria contas.
@Injectable()
export class UsuariosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly armazenamento: ArmazenamentoService,
  ) {}

  async listar() {
    const usuarios = await this.prisma.usuario.findMany({ select: SELECAO, orderBy: { id: 'asc' } });
    return usuarios.map(apresentar);
  }

  async criar(dto: CriarUsuarioDto) {
    try {
      const usuario = await this.prisma.usuario.create({
        data: { email: dto.email, papel: dto.papel, senhaHash: await bcrypt.hash(dto.senha, 10) },
        select: SELECAO,
      });
      return apresentar(usuario);
    } catch (erro) {
      if (erro instanceof Prisma.PrismaClientKnownRequestError && erro.code === 'P2002') {
        throw new ConflictException('Já existe um usuário com este e-mail.');
      }
      throw erro;
    }
  }

  // O admin nao pode rebaixar a si mesmo: evita ficar sem nenhum administrador.
  async alterarPapel(id: number, papel: Papel, idDoAdmin: number) {
    if (id === idDoAdmin) throw new BadRequestException('Você não pode alterar o seu próprio papel.');
    await this.buscar(id);
    const usuario = await this.prisma.usuario.update({ where: { id }, data: { papel }, select: SELECAO });
    return apresentar(usuario);
  }

  async remover(id: number, idDoAdmin: number) {
    if (id === idDoAdmin) throw new BadRequestException('Você não pode remover a sua própria conta.');
    const usuario = await this.buscar(id);
    const imagens = await this.prisma.imagem.findMany({ where: { usuarioId: id }, select: { arquivo: true } });
    await this.prisma.usuario.delete({ where: { id } }); // as imagens do acervo saem junto (cascata)
    // Arquivos em disco: so depois de o banco confirmar
    await Promise.all([
      this.armazenamento.remover(usuario.avatarArquivo),
      ...imagens.map((i) => this.armazenamento.remover(i.arquivo)),
    ]);
  }

  private async buscar(id: number) {
    const usuario = await this.prisma.usuario.findUnique({ where: { id }, select: SELECAO });
    if (!usuario) throw new NotFoundException('Usuário não encontrado.');
    return usuario;
  }
}
