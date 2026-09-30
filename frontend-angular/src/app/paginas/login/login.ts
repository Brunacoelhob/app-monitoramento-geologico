import { HttpErrorResponse } from '@angular/common/http';
import { Component, ElementRef, OnDestroy, afterNextRender, effect, inject, signal, viewChild } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Router } from '@angular/router';
import { AcessibilidadeServico } from '../../core/acessibilidade.servico';
import { AuthServico } from '../../core/auth.servico';

interface EfeitoVanta {
  destroy(): void;
}

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule, MatButtonModule, MatFormFieldModule, MatIconModule, MatInputModule, MatProgressSpinnerModule],
  templateUrl: './login.html',
  styleUrl: './login.scss',
})
export class Login implements OnDestroy {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthServico);
  private readonly roteador = inject(Router);
  private readonly a11y = inject(AcessibilidadeServico);
  private readonly fundo = viewChild.required<ElementRef<HTMLElement>>('fundo');

  protected readonly formulario = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    senha: ['', Validators.required],
  });

  protected readonly carregando = signal(false);
  protected readonly erro = signal<string | null>(null);
  protected readonly mostrarSenha = signal(false);

  protected readonly efeitoAtivo = signal(false);
  private efeito?: EfeitoVanta;
  private pronto = signal(false);
  private geracao = 0; // descarta cargas antigas se o usuario mudar "reduzir animacoes" rapido

  constructor() {
    afterNextRender(() => this.pronto.set(true));

    // Liga o efeito quando a tela abre; desliga com "reduzir animacoes"
    effect(() => {
      const reduzir = this.a11y.reduzirMovimento();
      if (this.pronto()) void this.atualizarEfeito(reduzir);
    });
  }

  ngOnDestroy() {
    this.geracao++;
    this.efeito?.destroy();
  }

  // Vanta (globo 3D) so carrega aqui, sob demanda; em celular e com "reduzir animacoes"
  // o fundo fica parado (a ilustracao do hero).
  private async atualizarEfeito(reduzir: boolean) {
    const minha = ++this.geracao;
    this.efeito?.destroy();
    this.efeito = undefined;
    this.efeitoAtivo.set(false);
    if (reduzir || window.innerWidth < 860) return;

    try {
      const [three, globo] = await Promise.all([import('three'), import('vanta/dist/vanta.globe.min')]);
      if (minha !== this.geracao) return; // ficou velho enquanto carregava
      this.efeito = (globo.default ?? globo)({
        el: this.fundo().nativeElement,
        THREE: three,
        mouseControls: true,
        touchControls: false,
        gyroControls: false,
        minHeight: 200,
        minWidth: 200,
        scale: 1,
        color: 0xc59f6d, // ocre: pontos
        color2: 0x7fa6e8, // azul: linhas
        backgroundColor: 0x0d151d,
        size: 0.8, // globo menor e mais elegante
        points: 9,
        maxDistance: 20,
        spacing: 22,
      }) as EfeitoVanta;
      this.efeitoAtivo.set(true);
    } catch {
      // Sem WebGL (ou sem a biblioteca): fica a ilustracao parada, o login segue normal.
    }
  }

  protected entrar(): void {
    if (this.formulario.invalid) {
      this.formulario.markAllAsTouched();
      return;
    }

    const { email, senha } = this.formulario.getRawValue();
    this.carregando.set(true);
    this.erro.set(null);

    this.auth.login(email, senha).subscribe({
      next: () => this.roteador.navigate(['/inicio']),
      error: (erro: HttpErrorResponse) => {
        this.carregando.set(false);
        this.erro.set(this.mensagemDeErro(erro));
      },
    });
  }

  private mensagemDeErro(erro: HttpErrorResponse): string {
    if (erro.status === 0) return 'Não foi possível conectar ao servidor.';
    if (erro.status === 429) return 'Muitas tentativas. Aguarde um minuto.';
    return 'E-mail ou senha inválidos.';
  }
}
