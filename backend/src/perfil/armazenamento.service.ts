import { BadRequestException, Injectable, OnModuleInit } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { createReadStream, existsSync } from 'fs';
import { mkdir, unlink, writeFile } from 'fs/promises';
import { join, resolve } from 'path';

export interface ArquivoSalvo {
  arquivo: string;
  mime: string;
  tamanho: number;
}

// Descobre o tipo real pelos primeiros bytes (o mimetype enviado pelo cliente
// pode ser falso). SVG fica de fora de proposito: pode carregar script.
function detectarTipo(buffer: Buffer): { mime: string; extensao: string } | null {
  if (buffer.length < 12) return null;
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { mime: 'image/jpeg', extensao: 'jpg' };
  }
  if (buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return { mime: 'image/png', extensao: 'png' };
  }
  const cabecalho = buffer.subarray(0, 6).toString('latin1');
  if (cabecalho === 'GIF87a' || cabecalho === 'GIF89a') return { mime: 'image/gif', extensao: 'gif' };
  if (buffer.subarray(0, 4).toString('latin1') === 'RIFF' && buffer.subarray(8, 12).toString('latin1') === 'WEBP') {
    return { mime: 'image/webp', extensao: 'webp' };
  }
  return null;
}

// Guarda as imagens em disco (pasta UPLOADS_DIR, volume no Docker). O banco so
// conhece o nome aleatorio gerado aqui, entao nenhum caminho vem do usuario.
@Injectable()
export class ArmazenamentoService implements OnModuleInit {
  private readonly pasta = resolve(process.env.UPLOADS_DIR ?? 'uploads');

  async onModuleInit() {
    await mkdir(this.pasta, { recursive: true });
  }

  async salvar(buffer: Buffer): Promise<ArquivoSalvo> {
    const tipo = detectarTipo(buffer);
    if (!tipo) {
      throw new BadRequestException('Arquivo invalido. Envie uma imagem JPG, PNG, GIF ou WEBP.');
    }
    const arquivo = `${randomUUID()}.${tipo.extensao}`;
    await writeFile(join(this.pasta, arquivo), buffer, { flag: 'wx' });
    return { arquivo, mime: tipo.mime, tamanho: buffer.length };
  }

  abrir(arquivo: string) {
    const caminho = join(this.pasta, arquivo);
    return existsSync(caminho) ? createReadStream(caminho) : null;
  }

  async remover(arquivo: string | null | undefined): Promise<void> {
    if (!arquivo) return;
    try {
      await unlink(join(this.pasta, arquivo));
    } catch {
      // arquivo ja nao existe: nada a fazer
    }
  }
}
