import { HttpErrorResponse } from '@angular/common/http';
import { DatePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar } from '@angular/material/snack-bar';
import { CabecalhoPagina } from '../../compartilhado/cabecalho-pagina/cabecalho-pagina';
import { ConfirmarDialog } from '../../compartilhado/confirmar-dialog/confirmar-dialog';
import { AuthServico } from '../../core/auth.servico';
import { Papel } from '../../core/modelos';
import { UsuarioLista, UsuariosServico } from '../../core/usuarios.servico';
import { NovoUsuarioDialog } from './novo-usuario-dialog/novo-usuario-dialog';

const ROTULO_PAPEL: Record<Papel, string> = { ADMIN: 'Administrador', VISUALIZADOR: 'Visualizador' };

// Tela do administrador: quem tem acesso ao sistema e com qual papel.
@Component({
  selector: 'app-usuarios',
  imports: [DatePipe, MatButtonModule, MatIconModule, MatSelectModule, CabecalhoPagina],
  templateUrl: './usuarios.html',
  styleUrl: './usuarios.scss',
})
export class Usuarios {
  private readonly api = inject(UsuariosServico);
  private readonly dialogo = inject(MatDialog);
  private readonly aviso = inject(MatSnackBar);
  protected readonly auth = inject(AuthServico);

  protected readonly usuarios = signal<UsuarioLista[]>([]);
  protected readonly carregando = signal(true);
  protected readonly erro = signal(false);
  protected readonly rotulo = ROTULO_PAPEL;

  constructor() {
    this.carregar();
  }

  // O token guarda so o e-mail: o proprio admin e reconhecido por ele para bloquear as acoes sobre si
  protected ehVoce(u: UsuarioLista) {
    return u.email === this.auth.usuario()?.email;
  }

  private carregar() {
    this.api.listar().subscribe({
      next: (lista) => {
        this.usuarios.set(lista);
        this.carregando.set(false);
      },
      error: () => {
        this.erro.set(true);
        this.carregando.set(false);
      },
    });
  }

  protected novo() {
    this.dialogo
      .open(NovoUsuarioDialog, { maxWidth: '92vw' })
      .afterClosed()
      .subscribe((criado) => {
        if (criado) {
          this.aviso.open('Usuário criado.', 'Fechar', { duration: 4000 });
          this.carregar();
        }
      });
  }

  protected mudarPapel(u: UsuarioLista, papel: Papel) {
    if (papel === u.papel) return;
    this.api.alterarPapel(u.id, papel).subscribe({
      next: () => {
        this.aviso.open(`${u.email} agora é ${ROTULO_PAPEL[papel].toLowerCase()}. Vale a partir do próximo login.`, 'Fechar', { duration: 6000 });
        this.carregar();
      },
      error: (e: HttpErrorResponse) => {
        this.aviso.open(e.error?.message || 'Não foi possível alterar o papel.', 'Fechar', { duration: 6000 });
        this.carregar();
      },
    });
  }

  protected remover(u: UsuarioLista) {
    this.dialogo
      .open(ConfirmarDialog, {
        data: {
          titulo: 'Remover usuário?',
          mensagem: `A conta de ${u.email}, o avatar e as imagens do acervo serão apagados. Esta ação não pode ser desfeita.`,
          confirmar: 'Remover',
        },
        maxWidth: '92vw',
      })
      .afterClosed()
      .subscribe((confirmou) => {
        if (!confirmou) return;
        this.api.remover(u.id).subscribe({
          next: () => {
            this.aviso.open('Usuário removido.', 'Fechar', { duration: 4000 });
            this.carregar();
          },
          error: (e: HttpErrorResponse) => this.aviso.open(e.error?.message || 'Não foi possível remover.', 'Fechar', { duration: 6000 }),
        });
      });
  }
}
