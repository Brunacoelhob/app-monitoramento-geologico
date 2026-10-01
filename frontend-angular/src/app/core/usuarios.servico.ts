import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Papel } from './modelos';

export interface UsuarioLista {
  id: number;
  email: string;
  papel: Papel;
  nome: string | null;
  criadoEm: string;
  temAvatar: boolean;
}

export interface NovoUsuario {
  email: string;
  senha: string;
  papel: Papel;
}

// Gestao de contas (somente ADMIN: o backend recusa os demais com 403).
@Injectable({ providedIn: 'root' })
export class UsuariosServico {
  private readonly http = inject(HttpClient);

  listar() {
    return this.http.get<UsuarioLista[]>('/api/usuarios');
  }

  criar(dados: NovoUsuario) {
    return this.http.post<UsuarioLista>('/api/usuarios', dados);
  }

  alterarPapel(id: number, papel: Papel) {
    return this.http.put<UsuarioLista>(`/api/usuarios/${id}/papel`, { papel });
  }

  remover(id: number) {
    return this.http.delete<void>(`/api/usuarios/${id}`);
  }
}
