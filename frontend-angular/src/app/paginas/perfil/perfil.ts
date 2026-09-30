import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { formatarCelular, formatarCep, formatarCpf } from '../../compartilhado/mascara.diretiva';
import { ConfirmarDialog } from '../../compartilhado/confirmar-dialog/confirmar-dialog';
import { formatarTamanho, mensagemDeErro } from '../../core/arquivo';
import { ImagemAcervo } from '../../core/modelos';
import {
  LIMITE_ACERVO,
  MAX_AVATAR,
  MAX_IMAGEM,
  PerfilServico,
  TIPOS_IMAGEM,
} from '../../core/perfil.servico';
import { AlterarSenhaDialog } from './alterar-senha-dialog/alterar-senha-dialog';
import { EditarPerfilDialog } from './editar-perfil-dialog/editar-perfil-dialog';
import { PreviaImagemDialog } from './previa-imagem-dialog/previa-imagem-dialog';

@Component({
  selector: 'app-perfil',
  imports: [
    DatePipe,
    MatButtonModule,
    MatCardModule,
    MatIconModule,
    MatMenuModule,
    MatProgressBarModule,
    MatTooltipModule,
  ],
  templateUrl: './perfil.html',
  styleUrl: './perfil.scss',
})
export class Perfil {
  protected readonly servico = inject(PerfilServico);
  private readonly dialogo = inject(MatDialog);
  private readonly aviso = inject(MatSnackBar);

  protected readonly limiteAcervo = LIMITE_ACERVO;
  protected readonly formatarTamanho = formatarTamanho;

  protected readonly perfil = this.servico.perfil;
  protected readonly ocupado = signal(false);
  protected readonly arrastando = signal(false);

  protected readonly iniciais = computed(() => {
    const base = this.perfil()?.nome || this.perfil()?.email || '?';
    const partes = base.split(/[\s@.]+/).filter(Boolean);
    return ((partes[0]?.[0] ?? '?') + (partes.length > 1 ? partes[1][0] : '')).toUpperCase();
  });

  // Valores ja formatados para exibicao (mascaras).
  protected readonly cpf = computed(() => formatarCpf(this.perfil()?.cpf));
  protected readonly celular = computed(() => formatarCelular(this.perfil()?.celular));
  protected readonly cep = computed(() => formatarCep(this.perfil()?.cep));

  constructor() {
    this.servico.carregar().subscribe({ error: () => undefined });
    this.servico.listarAcervo().subscribe({ error: () => undefined });
  }

  // ---------- Perfil ----------

  protected editarPerfil(): void {
    this.dialogo.open(EditarPerfilDialog, { maxWidth: '94vw', autoFocus: 'first-tabbable' });
  }

  protected alterarSenha(): void {
    this.dialogo.open(AlterarSenhaDialog, { maxWidth: '94vw', autoFocus: 'first-tabbable' });
  }

  // ---------- Avatar ----------

  protected escolherAvatar(evento: Event): void {
    const entrada = evento.target as HTMLInputElement;
    const arquivo = entrada.files?.[0];
    entrada.value = ''; // permite escolher o mesmo arquivo de novo
    if (!arquivo) return;

    if (!TIPOS_IMAGEM.includes(arquivo.type)) {
      this.aviso.open('Use uma imagem JPG, PNG, GIF ou WEBP.', 'Fechar', { duration: 5000 });
      return;
    }
    if (arquivo.size > MAX_AVATAR) {
      this.aviso.open('A foto de perfil pode ter no máximo 2 MB.', 'Fechar', { duration: 5000 });
      return;
    }

    this.executar(this.servico.enviarAvatar(arquivo), 'Foto de perfil atualizada.');
  }

  protected removerAvatar(): void {
    this.confirmar('Remover foto', 'Deseja remover sua foto de perfil?', 'Remover', () =>
      this.executar(this.servico.removerAvatar(), 'Foto removida.'),
    );
  }

  // ---------- Acervo ----------

  protected escolherImagens(evento: Event): void {
    const entrada = evento.target as HTMLInputElement;
    this.enviarImagens(Array.from(entrada.files ?? []));
    entrada.value = '';
  }

  protected soltar(evento: DragEvent): void {
    evento.preventDefault();
    this.arrastando.set(false);
    this.enviarImagens(Array.from(evento.dataTransfer?.files ?? []));
  }

  protected arrastar(evento: DragEvent, dentro: boolean): void {
    evento.preventDefault();
    this.arrastando.set(dentro);
  }

  private enviarImagens(arquivos: File[]): void {
    if (arquivos.length === 0) return;

    // Confere no navegador antes de enviar (o backend confere de novo).
    const validos = arquivos.filter((a) => TIPOS_IMAGEM.includes(a.type) && a.size <= MAX_IMAGEM);
    const recusados = arquivos.length - validos.length;
    const vagas = LIMITE_ACERVO - this.servico.acervo().length;

    if (validos.length > vagas) {
      this.aviso.open(`O acervo aceita no máximo ${LIMITE_ACERVO} imagens.`, 'Fechar', { duration: 5000 });
      return;
    }
    if (validos.length > 10) {
      this.aviso.open('Envie até 10 imagens por vez.', 'Fechar', { duration: 5000 });
      return;
    }
    if (validos.length === 0) {
      this.aviso.open('Use imagens JPG, PNG, GIF ou WEBP de até 5 MB.', 'Fechar', { duration: 5000 });
      return;
    }

    const aviso = recusados
      ? `${validos.length} enviada(s). ${recusados} ignorada(s): só JPG, PNG, GIF ou WEBP de até 5 MB.`
      : `${validos.length} imagem(ns) adicionada(s).`;
    this.executar(this.servico.enviarImagens(validos), aviso);
  }

  protected baixar(imagem: ImagemAcervo): void {
    this.servico.baixarImagem(imagem).subscribe({
      error: () => this.aviso.open('Não foi possível baixar a imagem.', 'Fechar', { duration: 5000 }),
    });
  }

  protected ampliar(imagem: ImagemAcervo): void {
    const url = this.servico.miniaturas()[imagem.id];
    if (!url) return;
    this.dialogo.open(PreviaImagemDialog, { data: { url, nome: imagem.nomeOriginal }, maxWidth: '94vw' });
  }

  protected excluir(imagem: ImagemAcervo): void {
    this.confirmar('Excluir imagem', `Excluir "${imagem.nomeOriginal}" do acervo? Não dá para desfazer.`, 'Excluir', () =>
      this.executar(this.servico.removerImagem(imagem.id), 'Imagem excluída.'),
    );
  }

  // ---------- Auxiliares ----------

  private confirmar(titulo: string, mensagem: string, confirmar: string, aoConfirmar: () => void): void {
    this.dialogo
      .open(ConfirmarDialog, { data: { titulo, mensagem, confirmar } })
      .afterClosed()
      .subscribe((confirmou) => confirmou && aoConfirmar());
  }

  private executar(operacao: { subscribe: (o: object) => unknown }, sucesso: string): void {
    this.ocupado.set(true);
    operacao.subscribe({
      next: () => {
        this.ocupado.set(false);
        this.aviso.open(sucesso, 'Ok', { duration: 4000 });
      },
      error: async (erro: unknown) => {
        this.ocupado.set(false);
        const mensagem = await mensagemDeErro(erro, 'Não foi possível concluir a operação.');
        this.aviso.open(mensagem, 'Fechar', { duration: 6000 });
      },
    });
  }
}
