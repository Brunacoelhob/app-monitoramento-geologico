import { Component, ElementRef, OnDestroy, afterNextRender, inject, signal, viewChild } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { AcessibilidadeServico, Daltonismo, FonteLeitura, PASSOS_FONTE, Tema } from '../../core/acessibilidade.servico';

// Barra fixa no topo da tela, em todas as paginas (inclusive o login).
// Todos os controles seguem o mesmo padrao visual: mesma altura, borda e tipografia.
@Component({
  selector: 'app-barra-acessibilidade',
  imports: [MatIconModule],
  templateUrl: './barra-acessibilidade.html',
  styleUrl: './barra-acessibilidade.scss',
})
export class BarraAcessibilidade implements OnDestroy {
  protected readonly a11y = inject(AcessibilidadeServico);
  protected readonly ultimoPasso = PASSOS_FONTE.length - 1;
  private readonly barra = viewChild.required<ElementRef<HTMLElement>>('barra');
  private observador?: ResizeObserver;

  // Em telas estreitas os controles ficam num painel que abre por um botao.
  protected readonly aberta = signal(false);

  protected readonly temas: { valor: Tema; rotulo: string }[] = [
    { valor: 'sistema', rotulo: 'Seguir o sistema' },
    { valor: 'claro', rotulo: 'Claro' },
    { valor: 'escuro', rotulo: 'Escuro' },
    { valor: 'contraste', rotulo: 'Alto contraste' },
  ];

  protected readonly daltonismos: { valor: Daltonismo; rotulo: string }[] = [
    { valor: 'nenhum', rotulo: 'Sem ajuste' },
    { valor: 'protanopia', rotulo: 'Protanopia' },
    { valor: 'deuteranopia', rotulo: 'Deuteranopia' },
    { valor: 'tritanopia', rotulo: 'Tritanopia' },
  ];

  protected readonly fontes: { valor: FonteLeitura; rotulo: string }[] = [
    { valor: 'padrao', rotulo: 'Padrão' },
    { valor: 'opendyslexic', rotulo: 'OpenDyslexic' },
    { valor: 'verdana', rotulo: 'Verdana' },
  ];

  constructor() {
    // O widget VLibras carrega uma vez, em qualquer pagina.
    this.a11y.iniciarVLibras();

    // A barra pode quebrar em duas linhas: o resto da pagina acompanha a altura real.
    afterNextRender(() => {
      const aplicar = () => document.documentElement.style.setProperty('--altura-acess', `${this.barra().nativeElement.offsetHeight}px`);
      this.observador = new ResizeObserver(aplicar);
      this.observador.observe(this.barra().nativeElement);
      aplicar();
    });
  }

  ngOnDestroy() {
    this.observador?.disconnect();
  }

  protected escolherTema(evento: Event) {
    this.a11y.definirTema((evento.target as HTMLSelectElement).value as Tema);
  }

  protected escolherDaltonismo(evento: Event) {
    this.a11y.definirDaltonismo((evento.target as HTMLSelectElement).value as Daltonismo);
  }

  protected escolherFonte(evento: Event) {
    this.a11y.definirFonteLeitura((evento.target as HTMLSelectElement).value as FonteLeitura);
  }

  // O foco vai para o conteudo principal (alem de rolar ate ele).
  protected irParaConteudo(evento: Event) {
    evento.preventDefault();
    const conteudo = document.getElementById('conteudo');
    conteudo?.focus();
    conteudo?.scrollIntoView();
  }
}
