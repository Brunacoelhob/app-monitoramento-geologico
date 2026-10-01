import { Component, ElementRef, OnDestroy, afterNextRender, effect, inject, input, output, signal, viewChild } from '@angular/core';
import * as L from 'leaflet';
import { AcessibilidadeServico } from '../../core/acessibilidade.servico';
import { Estacao, PontoMapa, Regiao } from '../../core/modelos';
import { dataJst, nivelDe } from '../../core/nivel';
import { nomePlaca } from '../../core/placas';

const MUNDO: L.LatLngBoundsLiteral = [[-58, -175], [75, 185]];
const ROTULO_NIVEL = { REGISTRO: 'Registro', ATENCAO: 'Atenção', ALTO: 'Alto', CRITICO: 'Crítico' } as const;

const linha = (rotulo: string, valor: string) => {
  const p = document.createElement('div');
  const forte = document.createElement('strong');
  forte.textContent = `${rotulo}: `;
  p.append(forte, document.createTextNode(valor));
  return p;
};

// Arquivo dos limites de placas: baixado uma vez e reaproveitado entre mapas
let placasEmCache: Promise<unknown> | null = null;
const carregarPlacas = () => (placasEmCache ??= fetch('/dados/placas-mundo.geojson').then((r) => r.json()));

// Mapa-mundi dos sismos: regioes clicaveis (escolhem o que os graficos mostram), epicentros
// (tamanho = magnitude; cor = nivel), estacoes e os limites reais entre as placas tectonicas.
// Todo texto vindo da API entra como texto (nunca como HTML).
@Component({
  selector: 'app-mapa-sismos',
  templateUrl: './mapa-sismos.html',
  styleUrl: './mapa-sismos.scss',
})
export class MapaSismos implements OnDestroy {
  readonly pontos = input<PontoMapa[]>([]);
  readonly estacoes = input<Estacao[]>([]);
  readonly regioes = input<Regiao[]>([]);
  readonly regiao = input<string | null>(null);
  readonly altura = input('34rem');
  readonly compacto = input(false);
  readonly escolherRegiao = output<string | null>();

  private readonly a11y = inject(AcessibilidadeServico);
  private readonly recipiente = viewChild.required<ElementRef<HTMLDivElement>>('mapa');

  private mapa?: L.Map;
  private base?: L.TileLayer;
  private baseEscura: boolean | null = null;
  private placas?: L.GeoJSON;
  private readonly camadaRegioes = L.layerGroup();
  private readonly camadaEventos = L.layerGroup();
  private readonly camadaEstacoes = L.layerGroup();
  private observador?: ResizeObserver;
  private regiaoAnterior: string | null | undefined;
  private readonly pronto = signal(false);

  protected readonly cores = this.a11y.cores;

  constructor() {
    afterNextRender(() => {
      this.iniciar();
      this.pronto.set(true);
    });

    // Redesenha quando os dados, o tema ou o modo de daltonismo mudam.
    effect(() => {
      if (!this.pronto()) return;
      const cores = this.a11y.cores();
      this.trocarBase(this.a11y.escuro());
      this.desenharRegioes(this.regioes(), this.regiao(), cores.acento);
      this.desenharEventos(this.pontos(), cores);
      this.desenharEstacoes(this.estacoes(), cores);
      this.estilarPlacas(cores);
    });

    // Escolheu uma regiao (no mapa, na lista ou nos filtros): o mapa aproxima dela.
    effect(() => {
      const codigo = this.regiao();
      if (!this.pronto() || codigo === this.regiaoAnterior) return;
      this.regiaoAnterior = codigo;
      this.enquadrar(codigo);
    });
  }

  ngOnDestroy() {
    this.observador?.disconnect();
    this.mapa?.remove();
  }

  private iniciar() {
    const compacto = this.compacto();
    this.mapa = L.map(this.recipiente().nativeElement, {
      zoomControl: !compacto,
      scrollWheelZoom: !compacto, // no mini-mapa a rolagem da pagina nao pode ser "sequestrada"
      dragging: !compacto,
      keyboard: !compacto,
      attributionControl: true,
      minZoom: 1.5,
      zoomSnap: 0.25,
      worldCopyJump: true,
    });
    // Camadas em ordem: regioes (fundo) < placas < epicentros < estacoes
    this.mapa.createPane('regioes').style.zIndex = '350';
    this.mapa.createPane('placas').style.zIndex = '380';
    this.camadaRegioes.addTo(this.mapa);
    this.camadaEstacoes.addTo(this.mapa);
    this.camadaEventos.addTo(this.mapa);
    this.mapa.attributionControl.addAttribution('Limites de placas: Bird (2003), via Hugo Ahlenius/Nordpil (ODC-By)');
    this.regiaoAnterior = this.regiao();
    this.enquadrar(this.regiao(), false);

    carregarPlacas()
      .then((geo) => {
        if (!this.mapa) return;
        this.placas = L.geoJSON(geo as never, { pane: 'placas', interactive: true }).addTo(this.mapa);
        this.placas.eachLayer((camada) => {
          const p = (camada as L.Polyline & { feature?: { properties?: { PlateA?: string; PlateB?: string; Type?: string } } }).feature?.properties;
          if (!p) return;
          const dica = document.createElement('span');
          dica.textContent = `${nomePlaca(p.PlateA ?? '')} e ${nomePlaca(p.PlateB ?? '')}: ${p.Type === 'subduction' ? 'subducção (uma placa mergulha sob a outra)' : 'limite entre placas'}`;
          camada.bindTooltip(dica, { sticky: true });
        });
        this.estilarPlacas(this.a11y.cores());
      })
      .catch(() => undefined);

    // O mapa precisa recalcular o tamanho quando o container muda (abas, menu recolhido)
    this.observador = new ResizeObserver(() => this.mapa?.invalidateSize());
    this.observador.observe(this.recipiente().nativeElement);
  }

  private enquadrar(codigo: string | null, animar = true) {
    if (!this.mapa) return;
    const r = this.regioes().find((x) => x.codigo === codigo);
    const limites: L.LatLngBoundsLiteral = r ? [[r.latMin, r.lonMin], [r.latMax, r.lonMax]] : MUNDO;
    this.mapa.fitBounds(limites, { animate: animar && !this.a11y.reduzirMovimento(), padding: [8, 8] });
  }

  private trocarBase(escuro: boolean) {
    if (!this.mapa || this.baseEscura === escuro) return;
    this.baseEscura = escuro;
    this.base?.remove();
    // Mapa-base cinza do Esri (o CARTO passou a exigir chave de API)
    const estilo = escuro ? 'World_Dark_Gray_Base' : 'World_Light_Gray_Base';
    this.base = L.tileLayer(`https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/${estilo}/MapServer/tile/{z}/{y}/{x}`, {
      maxZoom: 12,
      attribution: 'Mapa-base: Esri, HERE, Garmin, OpenStreetMap',
    }).addTo(this.mapa);
    this.base.bringToBack();
  }

  private estilarPlacas(cores: ReturnType<typeof this.a11y.cores>) {
    // Subduccao (uma placa mergulha sob a outra) em destaque; demais limites mais finos
    this.placas?.setStyle((feicao) => {
      const subducao = (feicao?.properties as { Type?: string })?.Type === 'subduction';
      return subducao
        ? { color: cores.atencao, weight: 2.4, dashArray: '7 5', opacity: 0.95 }
        : { color: cores.textoSecundario, weight: 1.3, opacity: 0.8 };
    });
  }

  // Retangulo de cada regiao: a cor e mais forte onde ha mais sismos; clicar escolhe a regiao
  private desenharRegioes(regioes: Regiao[], escolhida: string | null, cor: string) {
    this.camadaRegioes.clearLayers();
    const maximo = Math.max(1, ...regioes.map((r) => r.eventos));
    for (const r of regioes) {
      const selecionada = r.codigo === escolhida;
      const retangulo = L.rectangle([[r.latMin, r.lonMin], [r.latMax, r.lonMax]], {
        pane: 'regioes',
        color: cor,
        weight: selecionada ? 3 : 1,
        opacity: selecionada ? 1 : 0.55,
        fillColor: cor,
        fillOpacity: selecionada ? 0.08 : 0.04 + 0.26 * (r.eventos / maximo),
        dashArray: selecionada ? undefined : '3 4',
      });
      const dica = document.createElement('div');
      const titulo = document.createElement('strong');
      titulo.textContent = r.nome;
      dica.append(titulo, linha('Sismos no período', String(r.eventos)), linha('Maior magnitude', r.maiorMagnitude !== null ? `M${r.maiorMagnitude.toFixed(1)}` : '-'));
      if (!selecionada) dica.append(document.createTextNode('Clique para escolher esta região'));
      retangulo.bindTooltip(dica, { sticky: true });
      retangulo.on('click', () => this.escolherRegiao.emit(selecionada ? null : r.codigo));
      retangulo.addTo(this.camadaRegioes);
    }
  }

  private desenharEventos(pontos: PontoMapa[], cores: ReturnType<typeof this.a11y.cores>) {
    this.camadaEventos.clearLayers();
    const corNivel = { REGISTRO: cores.textoSecundario, ATENCAO: cores.atencao, ALTO: cores.alto, CRITICO: cores.critico };
    // Menores primeiro: os grandes ficam por cima
    for (const p of [...pontos].sort((a, b) => a.magnitude - b.magnitude)) {
      const nivel = nivelDe(p.magnitude);
      const marcador = L.circleMarker([p.latitude, p.longitude], {
        radius: 3 + Math.max(0, p.magnitude - 3.5) * 3.5,
        color: cores.fundo,
        weight: 1.5,
        fillColor: corNivel[nivel],
        fillOpacity: 0.85,
      });
      const dica = document.createElement('span');
      dica.textContent = `M${p.magnitude.toFixed(1)} (${ROTULO_NIVEL[nivel]}) - ${p.local}`;
      marcador.bindTooltip(dica);

      const caixa = document.createElement('div');
      const titulo = document.createElement('strong');
      titulo.textContent = `Magnitude ${p.magnitude.toFixed(1)} (${ROTULO_NIVEL[nivel]})`;
      caixa.append(titulo, linha('Local', p.local), linha('Profundidade', `${p.profundidadeKm.toFixed(1).replace('.', ',')} km`), linha('Quando', dataJst(p.ocorridoEm)), linha('Origem', p.origem === 'SIMULADO' ? 'Simulado' : 'Real (USGS)'));
      marcador.bindPopup(caixa);
      marcador.addTo(this.camadaEventos);
    }
  }

  private desenharEstacoes(estacoes: Estacao[], cores: ReturnType<typeof this.a11y.cores>) {
    this.camadaEstacoes.clearLayers();
    for (const e of estacoes) {
      if (e.latitude === null || e.longitude === null) continue;
      const icone = L.divIcon({
        className: '',
        html: `<span class="estacao ${e.origem === 'SIMULADO' ? 'simulada' : ''} ${e.online ? 'online' : 'offline'}" style="--cor:${cores.texto};--fundo:${cores.fundo}"></span>`,
        iconSize: [16, 16],
        iconAnchor: [8, 8],
      });
      const marcador = L.marker([e.latitude, e.longitude], { icon: icone, keyboard: false });
      const caixa = document.createElement('div');
      const titulo = document.createElement('strong');
      titulo.textContent = `Estação ${e.nome}`;
      caixa.append(titulo, linha('Origem', e.origem === 'SIMULADO' ? 'Simulada' : 'Real'), linha('Situação', !e.ativa ? 'Inativa' : e.online ? 'Online' : 'Sem comunicação'));
      marcador.bindPopup(caixa);
      marcador.bindTooltip(`Estação ${e.nome}`);
      marcador.addTo(this.camadaEstacoes);
    }
  }
}
