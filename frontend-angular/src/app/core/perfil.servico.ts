import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { forkJoin, map, of, switchMap, tap } from 'rxjs';
import { salvarArquivo } from './arquivo';
import { DadosPerfil, ImagemAcervo, Perfil } from './modelos';

export const LIMITE_ACERVO = 50;
export const TIPOS_IMAGEM = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
export const MAX_AVATAR = 2 * 1024 * 1024;
export const MAX_IMAGEM = 5 * 1024 * 1024;

// Perfil do usuario logado, avatar e acervo de imagens. As imagens exigem o
// JWT, entao sao baixadas como Blob e exibidas por URL local (blob:).
@Injectable({ providedIn: 'root' })
export class PerfilServico {
  private readonly http = inject(HttpClient);

  readonly perfil = signal<Perfil | null>(null);
  readonly avatarUrl = signal<string | null>(null);
  readonly acervo = signal<ImagemAcervo[]>([]);
  readonly miniaturas = signal<Record<number, string>>({});

  carregar() {
    return this.http.get<Perfil>('/api/perfil').pipe(
      tap((perfil) => this.perfil.set(perfil)),
      switchMap((perfil) => (perfil.temAvatar ? this.carregarAvatar() : of(this.limparAvatar()))),
    );
  }

  atualizar(dados: DadosPerfil) {
    return this.http.put<Perfil>('/api/perfil', dados).pipe(tap((perfil) => this.perfil.set(perfil)));
  }

  alterarSenha(senhaAtual: string, novaSenha: string) {
    return this.http.put<void>('/api/perfil/senha', { senhaAtual, novaSenha });
  }

  // ---- Avatar ----

  enviarAvatar(arquivo: File) {
    const corpo = new FormData();
    corpo.append('arquivo', arquivo);
    return this.http.put<void>('/api/perfil/avatar', corpo).pipe(switchMap(() => this.carregar()));
  }

  removerAvatar() {
    return this.http.delete<void>('/api/perfil/avatar').pipe(switchMap(() => this.carregar()));
  }

  private carregarAvatar() {
    return this.http.get('/api/perfil/avatar', { responseType: 'blob' }).pipe(
      tap((blob) => {
        this.limparAvatar();
        this.avatarUrl.set(URL.createObjectURL(blob));
      }),
      map(() => undefined),
    );
  }

  private limparAvatar(): void {
    const atual = this.avatarUrl();
    if (atual) URL.revokeObjectURL(atual);
    this.avatarUrl.set(null);
  }

  // ---- Acervo ----

  listarAcervo() {
    return this.http.get<ImagemAcervo[]>('/api/perfil/acervo').pipe(
      tap((imagens) => {
        this.acervo.set(imagens);
        this.carregarMiniaturas(imagens);
      }),
    );
  }

  enviarImagens(arquivos: File[]) {
    const corpo = new FormData();
    for (const arquivo of arquivos) corpo.append('arquivos', arquivo);
    return this.http.post<void>('/api/perfil/acervo', corpo).pipe(switchMap(() => this.listarAcervo()));
  }

  removerImagem(id: number) {
    return this.http.delete<void>(`/api/perfil/acervo/${id}`).pipe(
      tap(() => this.descartarMiniatura(id)),
      switchMap(() => this.listarAcervo()),
    );
  }

  baixarImagem(imagem: ImagemAcervo) {
    return this.http
      .get(`/api/perfil/acervo/${imagem.id}/arquivo`, { params: { baixar: 1 }, responseType: 'blob' })
      .pipe(tap((blob) => salvarArquivo(blob, imagem.nomeOriginal)));
  }

  // Baixa so as miniaturas que ainda nao estao em cache.
  private carregarMiniaturas(imagens: ImagemAcervo[]): void {
    const atuais = this.miniaturas();
    const novas = imagens.filter((imagem) => !atuais[imagem.id]);
    if (novas.length === 0) return;
    forkJoin(
      novas.map((imagem) =>
        this.http
          .get(`/api/perfil/acervo/${imagem.id}/arquivo`, { responseType: 'blob' })
          .pipe(map((blob) => [imagem.id, URL.createObjectURL(blob)] as const)),
      ),
    ).subscribe((pares) => this.miniaturas.update((m) => ({ ...m, ...Object.fromEntries(pares) })));
  }

  private descartarMiniatura(id: number): void {
    const url = this.miniaturas()[id];
    if (url) URL.revokeObjectURL(url);
    this.miniaturas.update(({ [id]: _removida, ...resto }) => resto);
  }

  // Ao sair, nada do usuario anterior pode ficar na memoria.
  limpar(): void {
    this.limparAvatar();
    Object.values(this.miniaturas()).forEach((url) => URL.revokeObjectURL(url));
    this.miniaturas.set({});
    this.acervo.set([]);
    this.perfil.set(null);
  }
}
