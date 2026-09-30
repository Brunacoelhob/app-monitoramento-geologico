import { Component, ElementRef, afterNextRender, effect, inject, input, viewChild, OnDestroy } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AcessibilidadeServico } from '../../core/acessibilidade.servico';

let proximoId = 0;

// Faixa de abertura: imagem tematica, h1, uma frase e um botao. Por cima da imagem
// corre um traco de sismografo (canvas leve) que para com "reduzir animacoes".
@Component({
  selector: 'app-hero',
  imports: [RouterLink],
  templateUrl: './hero.html',
  styleUrl: './hero.scss',
})
export class Hero implements OnDestroy {
  readonly titulo = input.required<string>();
  readonly descricao = input('');
  readonly ctaRotulo = input('');
  readonly ctaRota = input<string | unknown[]>('/');

  protected readonly idTitulo = `hero-titulo-${proximoId++}`;

  private readonly a11y = inject(AcessibilidadeServico);
  private readonly tela = viewChild.required<ElementRef<HTMLCanvasElement>>('traco');

  private quadro = 0;
  private deslocamento = 0;
  private observador?: ResizeObserver;
  private pronto = false;

  constructor() {
    afterNextRender(() => {
      this.pronto = true;
      this.observador = new ResizeObserver(() => this.redimensionar());
      this.observador.observe(this.tela().nativeElement);
      this.redimensionar();
      document.addEventListener('visibilitychange', this.aoMudarVisibilidade);
    });

    // Liga/desliga a animacao conforme "reduzir animacoes" e o tamanho da tela
    effect(() => {
      const reduzido = this.a11y.reduzirMovimento();
      if (!this.pronto) return;
      this.atualizarMovimento(reduzido);
    });
  }

  ngOnDestroy() {
    cancelAnimationFrame(this.quadro);
    this.observador?.disconnect();
    document.removeEventListener('visibilitychange', this.aoMudarVisibilidade);
  }

  private readonly aoMudarVisibilidade = () => this.atualizarMovimento(this.a11y.reduzirMovimento());

  private redimensionar() {
    const canvas = this.tela().nativeElement;
    const escala = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, Math.floor(canvas.clientWidth * escala));
    canvas.height = Math.max(1, Math.floor(canvas.clientHeight * escala));
    this.atualizarMovimento(this.a11y.reduzirMovimento());
  }

  private atualizarMovimento(reduzido: boolean) {
    cancelAnimationFrame(this.quadro);
    const estreita = window.innerWidth < 640;
    if (reduzido || estreita || document.hidden) {
      this.desenhar(); // traco parado
      return;
    }
    const passo = () => {
      this.deslocamento += 1.4;
      this.desenhar();
      this.quadro = requestAnimationFrame(passo);
    };
    this.quadro = requestAnimationFrame(passo);
  }

  // Onda de fundo com "tremores" que aparecem de tempos em tempos
  private desenhar() {
    const canvas = this.tela().nativeElement;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const escala = window.devicePixelRatio || 1;
    const { width: w, height: h } = canvas;
    ctx.clearRect(0, 0, w, h);

    const meio = h * 0.5;
    ctx.lineWidth = 2 * escala;
    ctx.lineJoin = 'round';
    ctx.strokeStyle = 'rgba(224, 161, 0, 0.85)';
    ctx.beginPath();
    for (let x = 0; x <= w; x += 2) {
      const t = (x / escala + this.deslocamento) / 60;
      const tremor = Math.pow(Math.max(0, Math.sin(t / 11)), 14);
      const amplitude = (3 + 30 * tremor) * escala;
      const y = meio + amplitude * (0.6 * Math.sin(t * 7.3) + 0.3 * Math.sin(t * 13.1 + 1.7) + 0.1 * Math.sin(t * 29.7));
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
}
