import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { map, tap } from 'rxjs';
import { RespostaLogin, Sessao } from './modelos';
import { PerfilServico } from './perfil.servico';

const CHAVE_SESSAO = 'iot.sessao';

@Injectable({ providedIn: 'root' })
export class AuthServico {
  private readonly http = inject(HttpClient);
  private readonly roteador = inject(Router);
  private readonly perfil = inject(PerfilServico);

  private readonly _sessao = signal<Sessao | null>(this.lerSessao());

  readonly sessao = this._sessao.asReadonly();
  readonly token = computed(() => this._sessao()?.token ?? null);
  readonly usuario = computed(() => this._sessao()?.usuario ?? null);
  readonly autenticado = computed(() => this._sessao() !== null);

  login(email: string, senha: string) {
    return this.http.post<RespostaLogin>('/api/auth/login', { email, senha }).pipe(
      tap((resposta) => this.salvarSessao(resposta)),
      map(() => undefined),
    );
  }

  sair(): void {
    this._sessao.set(null);
    this.perfil.limpar();
    try {
      localStorage.removeItem(CHAVE_SESSAO);
    } catch {
      // storage indisponivel: a sessao em memoria ja foi limpa
    }
    this.roteador.navigate(['/login']);
  }

  // localStorage: a sessao continua ao atualizar a pagina ou reabrir o navegador.
  // O token vence sozinho (claim "exp" do JWT) e e descartado ao ler.
  private salvarSessao(sessao: Sessao): void {
    this._sessao.set(sessao);
    try {
      localStorage.setItem(CHAVE_SESSAO, JSON.stringify(sessao));
    } catch {
      // sem storage a sessao vale so ate recarregar a pagina
    }
  }

  private lerSessao(): Sessao | null {
    try {
      const texto = localStorage.getItem(CHAVE_SESSAO);
      if (!texto) return null;
      const sessao = JSON.parse(texto) as Sessao;
      if (this.tokenVencido(sessao.token)) {
        localStorage.removeItem(CHAVE_SESSAO);
        return null;
      }
      return sessao;
    } catch {
      return null;
    }
  }

  // Le o "exp" (segundos) do payload do JWT so para saber se ja venceu;
  // quem valida a assinatura de verdade e o backend.
  private tokenVencido(token: string): boolean {
    try {
      const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
      return typeof payload.exp === 'number' && payload.exp * 1000 <= Date.now();
    } catch {
      return true;
    }
  }
}
