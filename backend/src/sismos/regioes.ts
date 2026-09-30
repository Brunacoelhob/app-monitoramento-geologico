// Regioes do mundo para escolher no mapa. Cada uma e uma caixa geografica (simples e
// previsivel), com um texto curto sobre a geologia local. So as regioes com
// `alerta: true` geram alertas (RN-16); nas demais o sistema apenas mostra os sismos.

export interface Regiao {
  codigo: string;
  nome: string;
  latMin: number;
  latMax: number;
  lonMin: number;
  lonMax: number;
  centro: [number, number]; // [latitude, longitude]
  zoom: number;
  alerta: boolean;
  placas: string;
  contexto: string;
}

// A ordem importa: um ponto pertence a primeira regiao que o contem.
export const REGIOES: Regiao[] = [
  {
    codigo: 'JAPAO', nome: 'Japão', latMin: 24, latMax: 46, lonMin: 122, lonMax: 146, centro: [36, 138], zoom: 5, alerta: true,
    placas: 'Pacífica, Mar das Filipinas, Okhotsk e Amur',
    contexto: 'O Japão fica sobre o encontro de quatro placas. A placa do Pacífico mergulha sob o arquipélago na Fossa do Japão, e a do Mar das Filipinas na Fossa de Nankai. É uma das regiões mais ativas do planeta.',
  },
  {
    codigo: 'FILIPINAS', nome: 'Filipinas', latMin: 4, latMax: 21, lonMin: 116, lonMax: 128, centro: [12, 122], zoom: 5, alerta: false,
    placas: 'Mar das Filipinas e Sunda',
    contexto: 'A placa do Mar das Filipinas mergulha sob o arquipélago pela Fossa das Filipinas, e a falha das Filipinas corta o país de norte a sul.',
  },
  {
    codigo: 'INDONESIA', nome: 'Indonésia', latMin: -11, latMax: 6, lonMin: 95, lonMax: 141, centro: [-2, 117], zoom: 4, alerta: false,
    placas: 'Indo-Australiana, Sunda e Mar de Banda',
    contexto: 'A placa Indo-Australiana mergulha sob Sunda na Fossa de Sunda. Foi ali que aconteceu o terremoto de Sumatra, de magnitude 9,1, em 2004.',
  },
  {
    codigo: 'OCEANIA', nome: 'Nova Zelândia e Pacífico Sul', latMin: -50, latMax: -10, lonMin: 165, lonMax: 180, centro: [-30, 174], zoom: 4, alerta: false,
    placas: 'Pacífica, Indo-Australiana, Tonga e Novas Hébridas',
    contexto: 'Fossas de Tonga-Kermadec e das Novas Hébridas formam uma das zonas de subducção mais rápidas do mundo.',
  },
  {
    codigo: 'ALASCA', nome: 'Alasca e Aleutas', latMin: 50, latMax: 72, lonMin: -180, lonMax: -125, centro: [60, -150], zoom: 4, alerta: false,
    placas: 'Pacífica e América do Norte',
    contexto: 'A placa do Pacífico mergulha sob a América do Norte na Fossa das Aleutas. O terremoto do Alasca de 1964 teve magnitude 9,2.',
  },
  {
    codigo: 'AMERICA_NORTE_OESTE', nome: 'Costa oeste da América do Norte', latMin: 30, latMax: 50, lonMin: -130, lonMax: -110, centro: [40, -120], zoom: 5, alerta: false,
    placas: 'Pacífica, Juan de Fuca e América do Norte',
    contexto: 'A falha de San Andreas separa as placas Pacífica e América do Norte. Mais ao norte, a placa Juan de Fuca mergulha sob Cascadia.',
  },
  {
    codigo: 'MEXICO_AMERICA_CENTRAL', nome: 'México e América Central', latMin: 5, latMax: 30, lonMin: -118, lonMax: -77, centro: [16, -95], zoom: 5, alerta: false,
    placas: 'Cocos, Caribe e América do Norte',
    contexto: 'A placa de Cocos mergulha sob o México e a América Central, o que explica os terremotos frequentes e os vulcões da região.',
  },
  {
    codigo: 'ANDES', nome: 'Andes (América do Sul)', latMin: -56, latMax: 5, lonMin: -82, lonMax: -63, centro: [-23, -70], zoom: 4, alerta: false,
    placas: 'Nazca e América do Sul',
    contexto: 'A placa de Nazca mergulha sob a América do Sul e levantou os Andes. No Chile aconteceu o maior terremoto já medido, em 1960, de magnitude 9,5.',
  },
  {
    codigo: 'ISLANDIA', nome: 'Islândia e Atlântico Norte', latMin: 58, latMax: 70, lonMin: -30, lonMax: -10, centro: [64.5, -19], zoom: 5, alerta: false,
    placas: 'América do Norte e Eurásia',
    contexto: 'A dorsal meso-atlântica emerge na Islândia, onde as placas se afastam. Os sismos ali vêm do afastamento e do vulcanismo.',
  },
  {
    codigo: 'MEDITERRANEO', nome: 'Mediterrâneo e Turquia', latMin: 30, latMax: 48, lonMin: -10, lonMax: 45, centro: [38, 25], zoom: 4, alerta: false,
    placas: 'África, Eurásia, Anatólia e Arábia',
    contexto: 'A placa da África se aproxima da Eurásia, e a Anatólia é empurrada para o oeste. A falha da Anatólia Norte causou grandes terremotos na Turquia.',
  },
  {
    codigo: 'ASIA_CENTRAL', nome: 'Irã e Ásia Central', latMin: 22, latMax: 42, lonMin: 45, lonMax: 80, centro: [33, 62], zoom: 4, alerta: false,
    placas: 'Arábia, Eurásia e Índia',
    contexto: 'A colisão entre a Arábia, a Índia e a Eurásia deforma uma faixa larga de terra, com muitos terremotos rasos.',
  },
  {
    codigo: 'HIMALAIA', nome: 'Himalaia e China', latMin: 20, latMax: 42, lonMin: 80, lonMax: 110, centro: [31, 95], zoom: 4, alerta: false,
    placas: 'Índia, Eurásia e Yangtzé',
    contexto: 'A Índia avança contra a Eurásia cerca de 4 cm por ano e levanta o Himalaia. Os terremotos do Nepal, em 2015, e de Sichuan, em 2008, vieram dessa colisão.',
  },
];

export const regiaoPorCodigo = (codigo: string): Regiao | undefined => REGIOES.find((r) => r.codigo === codigo);

export const CODIGOS_REGIAO = REGIOES.map((r) => r.codigo);

export function regiaoDoPonto(ponto: { latitude: number; longitude: number }): Regiao | undefined {
  return REGIOES.find(
    (r) => ponto.latitude >= r.latMin && ponto.latitude <= r.latMax && ponto.longitude >= r.lonMin && ponto.longitude <= r.lonMax,
  );
}

// Alertas so existem onde o sistema monitora (hoje, o Japao).
export const emRegiaoMonitorada = (ponto: { latitude: number; longitude: number }): boolean =>
  REGIOES.some(
    (r) => r.alerta && ponto.latitude >= r.latMin && ponto.latitude <= r.latMax && ponto.longitude >= r.lonMin && ponto.longitude <= r.lonMax,
  );
