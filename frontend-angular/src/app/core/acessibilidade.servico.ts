import { Injectable, computed, effect, signal } from '@angular/core';

export type Tema = 'sistema' | 'claro' | 'escuro' | 'contraste';
export type TemaAplicado = 'claro' | 'escuro' | 'contraste';
export type Daltonismo = 'nenhum' | 'protanopia' | 'deuteranopia' | 'tritanopia';
export type FonteLeitura = 'padrao' | 'opendyslexic' | 'verdana';

// Passos do tamanho da fonte (% do tamanho padrao do navegador)
export const PASSOS_FONTE = [87.5, 100, 112.5, 125, 150];

interface Preferencias {
  tema: Tema;
  passoFonte: number;
  daltonismo: Daltonismo;
  fonteLeitura: FonteLeitura;
  reduzirMovimento: boolean | null; // null = seguir o sistema
}

const CHAVE = 'iot.acessibilidade';
const PADRAO: Preferencias = { tema: 'sistema', passoFonte: 1, daltonismo: 'nenhum', fonteLeitura: 'padrao', reduzirMovimento: null };

// Cores dos graficos e do mapa (o ECharts e o Leaflet nao leem variaveis CSS):
// espelham os tokens de src/styles.scss.
const BASE = {
  claro: { texto: '#0f172a', textoSecundario: '#5b6478', linha: '#e5e9f2', fundo: '#ffffff', acento: '#3b5bdb', frio: '#0891b2', calor: '#ea580c', atencao: '#d97706', alto: '#ea580c', critico: '#dc2626' },
  escuro: { texto: '#e8edf7', textoSecundario: '#93a0ba', linha: '#1f2a3f', fundo: '#111827', acento: '#7c9cff', frio: '#38bdf8', calor: '#fb923c', atencao: '#fbbf24', alto: '#fb923c', critico: '#f87171' },
  contraste: { texto: '#ffffff', textoSecundario: '#ededed', linha: '#ffffff', fundo: '#000000', acento: '#ffe600', frio: '#5cc8ff', calor: '#ffb000', atencao: '#ffd400', alto: '#ff8a00', critico: '#ff5c5c' },
};
export type CoresGrafico = Record<keyof (typeof BASE)['claro'], string>;

const DALTONISMO = {
  protanopia: { frio: '#0072b2', calor: '#e69f00', atencao: '#f0e442', alto: '#e69f00', critico: '#cc79a7' },
  deuteranopia: { frio: '#0072b2', calor: '#e69f00', atencao: '#f0e442', alto: '#e69f00', critico: '#cc79a7' },
  tritanopia: { frio: '#008b8b', calor: '#d7263d', atencao: '#ffb000', alto: '#fe6100', critico: '#dc267f' },
};

// Tudo o que e acessibilidade e aparencia: tema, fonte, daltonismo, dislexia,
// movimento, leitura em voz alta e VLibras. As escolhas ficam salvas no navegador.
@Injectable({ providedIn: 'root' })
export class AcessibilidadeServico {
  private readonly prefs = signal<Preferencias>(this.ler());
  private readonly sistemaEscuro = signal(window.matchMedia('(prefers-color-scheme: dark)').matches);
  private readonly sistemaReduz = signal(window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  readonly tema = computed(() => this.prefs().tema);
  readonly passoFonte = computed(() => this.prefs().passoFonte);
  readonly percentualFonte = computed(() => PASSOS_FONTE[this.prefs().passoFonte]);
  readonly daltonismo = computed(() => this.prefs().daltonismo);
  readonly fonteLeitura = computed(() => this.prefs().fonteLeitura);
  readonly reduzirMovimento = computed(() => this.prefs().reduzirMovimento ?? this.sistemaReduz());
  readonly lendo = signal(false);

  readonly temaAplicado = computed<TemaAplicado>(() => {
    const tema = this.prefs().tema;
    return tema === 'sistema' ? (this.sistemaEscuro() ? 'escuro' : 'claro') : tema;
  });
  // Para graficos e mapa: tudo que nao e claro usa fundo escuro
  readonly escuro = computed(() => this.temaAplicado() !== 'claro');

  readonly cores = computed(() => {
    const base = BASE[this.temaAplicado()];
    const dalt = this.prefs().daltonismo;
    return dalt === 'nenhum' ? base : { ...base, ...DALTONISMO[dalt] };
  });

  private vlibrasCarregado = false;

  constructor() {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => this.sistemaEscuro.set(e.matches));
    window.matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', (e) => this.sistemaReduz.set(e.matches));

    // Reflete as escolhas no <html>: o CSS (tokens) faz o resto.
    effect(() => {
      const raiz = document.documentElement;
      raiz.dataset['tema'] = this.temaAplicado();
      raiz.dataset['daltonismo'] = this.prefs().daltonismo;
      raiz.dataset['fonte'] = this.prefs().fonteLeitura;
      raiz.dataset['movimento'] = this.reduzirMovimento() ? 'reduzido' : 'normal';
      raiz.style.fontSize = `${this.percentualFonte()}%`;
    });
  }

  // ---------- Escolhas ----------

  definirTema(tema: Tema) { this.atualizar({ tema }); }
  definirDaltonismo(daltonismo: Daltonismo) { this.atualizar({ daltonismo }); }
  definirFonteLeitura(fonteLeitura: FonteLeitura) { this.atualizar({ fonteLeitura }); }
  alternarMovimento() { this.atualizar({ reduzirMovimento: !this.reduzirMovimento() }); }
  aumentarFonte() { this.atualizar({ passoFonte: Math.min(this.prefs().passoFonte + 1, PASSOS_FONTE.length - 1) }); }
  diminuirFonte() { this.atualizar({ passoFonte: Math.max(this.prefs().passoFonte - 1, 0) }); }
  restaurarFonte() { this.atualizar({ passoFonte: PADRAO.passoFonte }); }

  // ---------- Ler a pagina em voz alta (sintese de voz do navegador) ----------

  lerPagina(): void {
    const voz = window.speechSynthesis;
    if (!voz) return;
    if (this.lendo()) {
      voz.cancel();
      this.lendo.set(false);
      return;
    }

    const conteudo = document.getElementById('conteudo');
    const texto = (conteudo?.innerText ?? '').replace(/\s+/g, ' ').trim();
    if (!texto) return;

    // Frases curtas: o Chrome interrompe falas muito longas.
    const partes = texto.match(/[^.!?]+[.!?]*/g) ?? [texto];
    this.lendo.set(true);
    partes.forEach((parte, i) => {
      const fala = new SpeechSynthesisUtterance(parte.trim());
      fala.lang = 'pt-BR';
      if (i === partes.length - 1) fala.onend = () => this.lendo.set(false);
      fala.onerror = () => this.lendo.set(false);
      voz.speak(fala);
    });
  }

  // ---------- VLibras (widget oficial do governo) ----------

  // Carrega o widget na primeira vez que a pagina abre (depende de internet). O botao fica no lugar padrao do
  // VLibras: lateral direita da tela.
  iniciarVLibras(): void {
    if (this.vlibrasCarregado) return;
    this.vlibrasCarregado = true;

    document.body.insertAdjacentHTML(
      'beforeend',
      '<div vw class="enabled"><div vw-access-button class="active"></div><div vw-plugin-wrapper><div class="vw-plugin-top-wrapper"></div></div></div>',
    );
    const script = document.createElement('script');
    script.src = 'https://vlibras.gov.br/app/vlibras-plugin.js';
    script.async = true;
    script.onload = () => {
      const vlibras = (window as unknown as { VLibras?: { Widget: new (url: string) => unknown } }).VLibras;
      if (vlibras) new vlibras.Widget('https://vlibras.gov.br/app');
    };
    // Sem internet o widget simplesmente nao aparece; o resto do sistema segue normal.
    script.onerror = () => document.querySelector('[vw]')?.remove();
    document.body.appendChild(script);
  }

  // ---------- Persistencia ----------

  private atualizar(parcial: Partial<Preferencias>) {
    const novo = { ...this.prefs(), ...parcial };
    this.prefs.set(novo);
    try {
      localStorage.setItem(CHAVE, JSON.stringify(novo));
    } catch {
      // sem storage, as escolhas valem so ate recarregar a pagina
    }
  }

  private ler(): Preferencias {
    try {
      const salvo = JSON.parse(localStorage.getItem(CHAVE) ?? 'null');
      if (!salvo) return PADRAO;
      // Versao anterior guardava so "dislexia: true/false": vira OpenDyslexic
      if (salvo.dislexia === true && !salvo.fonteLeitura) salvo.fonteLeitura = 'opendyslexic';
      delete salvo.dislexia;
      return { ...PADRAO, ...salvo };
    } catch {
      return PADRAO;
    }
  }
}
