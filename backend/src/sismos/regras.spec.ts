import { deveEncerrarAtencao, distanciaKm, ehReplica, estaOnline, nivelPorMagnitude, validarLeitura } from './regras';
import { emRegiaoMonitorada, regiaoDoPonto } from './regioes';
import { lerGeoJsonUsgs } from './usgs.parser';

const AGORA = new Date('2026-09-30T12:00:00Z');
const LIMITES = { atrasoMaximoHoras: 24, toleranciaFuturoMinutos: 5 };

describe('RN-13: nivel por magnitude', () => {
  it.each([
    [3.9, null],
    [4.4, null],
    [4.5, 'ATENCAO'],
    [5.4, 'ATENCAO'],
    [5.5, 'ALTO'],
    [6.4, 'ALTO'],
    [6.5, 'CRITICO'],
    [9.1, 'CRITICO'],
  ])('magnitude %s -> %s', (magnitude, esperado) => {
    expect(nivelPorMagnitude(magnitude)).toBe(esperado);
  });
});

describe('RN-15: distancia', () => {
  it('Toquio a Osaka fica perto de 400 km', () => {
    const toquio = { latitude: 35.68, longitude: 139.69 };
    const osaka = { latitude: 34.69, longitude: 135.5 };
    expect(distanciaKm(toquio, osaka)).toBeGreaterThan(390);
    expect(distanciaKm(toquio, osaka)).toBeLessThan(410);
  });

  it('o mesmo ponto esta a zero km', () => {
    expect(distanciaKm({ latitude: 10, longitude: 10 }, { latitude: 10, longitude: 10 })).toBe(0);
  });
});

describe('RN-21: replicas', () => {
  const limites = { replicaKm: 50, replicaHoras: 24 };
  const principal = { magnitude: 6.0, latitude: 38.0, longitude: 142.0, ocorridoEm: new Date('2026-09-30T00:00:00Z') };

  it('evento menor, proximo e ate 24 h depois e replica', () => {
    const e = { magnitude: 4.8, latitude: 38.1, longitude: 142.1, ocorridoEm: new Date('2026-09-30T05:00:00Z') };
    expect(ehReplica(e, principal, limites)).toBe(true);
  });

  it('magnitude igual tambem e replica', () => {
    expect(ehReplica({ ...principal, ocorridoEm: new Date('2026-09-30T01:00:00Z') }, principal, limites)).toBe(true);
  });

  it('magnitude maior vira alerta novo', () => {
    const e = { magnitude: 6.2, latitude: 38.1, longitude: 142.1, ocorridoEm: new Date('2026-09-30T05:00:00Z') };
    expect(ehReplica(e, principal, limites)).toBe(false);
  });

  it('depois de 24 h nao e replica', () => {
    const e = { magnitude: 4.8, latitude: 38.1, longitude: 142.1, ocorridoEm: new Date('2026-10-01T01:00:00Z') };
    expect(ehReplica(e, principal, limites)).toBe(false);
  });

  it('longe (mais de 50 km) nao e replica', () => {
    const e = { magnitude: 4.8, latitude: 39.0, longitude: 142.0, ocorridoEm: new Date('2026-09-30T05:00:00Z') };
    expect(ehReplica(e, principal, limites)).toBe(false);
  });

  it('antes do principal nao e replica', () => {
    const e = { magnitude: 4.8, latitude: 38.0, longitude: 142.0, ocorridoEm: new Date('2026-09-29T20:00:00Z') };
    expect(ehReplica(e, principal, limites)).toBe(false);
  });
});

describe('RN-20: encerramento automatico', () => {
  const aberto = (h: number) => new Date(AGORA.getTime() - h * 3_600_000);

  it('Atencao aberto ha mais de 72 h encerra', () => {
    expect(deveEncerrarAtencao({ nivel: 'ATENCAO', abertoEm: aberto(73) }, AGORA, 72)).toBe(true);
  });

  it('Atencao com menos de 72 h continua', () => {
    expect(deveEncerrarAtencao({ nivel: 'ATENCAO', abertoEm: aberto(10) }, AGORA, 72)).toBe(false);
  });

  it('Alto e Critico nunca encerram sozinhos', () => {
    expect(deveEncerrarAtencao({ nivel: 'ALTO', abertoEm: aberto(500) }, AGORA, 72)).toBe(false);
    expect(deveEncerrarAtencao({ nivel: 'CRITICO', abertoEm: aberto(500) }, AGORA, 72)).toBe(false);
  });
});

describe('RN-22 e RN-24: online', () => {
  it('leitura de 10 min atras esta online; de 20 min, nao', () => {
    expect(estaOnline(new Date(AGORA.getTime() - 10 * 60_000), AGORA, 15)).toBe(true);
    expect(estaOnline(new Date(AGORA.getTime() - 20 * 60_000), AGORA, 15)).toBe(false);
  });

  it('sem nenhuma leitura nao esta online', () => {
    expect(estaOnline(null, AGORA, 15)).toBe(false);
  });
});

describe('RN-10 e RN-11: validacao de leituras', () => {
  const agoraMenos = (min: number) => new Date(AGORA.getTime() - min * 60_000);

  it('aceita temperatura valida', () => {
    expect(validarLeitura('TEMPERATURA', { instante: agoraMenos(1), temperatura: 21.5 }, AGORA, LIMITES)).toBeNull();
  });

  it('recusa temperatura fora da faixa', () => {
    expect(validarLeitura('TEMPERATURA', { instante: agoraMenos(1), temperatura: 120 }, AGORA, LIMITES)).toMatch(/faixa/);
    expect(validarLeitura('TEMPERATURA', { instante: agoraMenos(1), temperatura: -61 }, AGORA, LIMITES)).toMatch(/faixa/);
  });

  it('recusa horario no futuro (tolerancia de 5 min)', () => {
    expect(validarLeitura('SISMOGRAFO', { instante: agoraMenos(-4), amplitude: 1 }, AGORA, LIMITES)).toBeNull();
    expect(validarLeitura('SISMOGRAFO', { instante: agoraMenos(-10), amplitude: 1 }, AGORA, LIMITES)).toMatch(/futuro/);
  });

  it('recusa leitura com mais de 24 h de atraso', () => {
    expect(validarLeitura('SISMOGRAFO', { instante: agoraMenos(23 * 60), amplitude: 1 }, AGORA, LIMITES)).toBeNull();
    expect(validarLeitura('SISMOGRAFO', { instante: agoraMenos(25 * 60), amplitude: 1 }, AGORA, LIMITES)).toMatch(/atrasada/);
  });

  it('valida latitude e longitude do GPS', () => {
    expect(validarLeitura('GPS', { instante: agoraMenos(1), latitude: 35, longitude: 139 }, AGORA, LIMITES)).toBeNull();
    expect(validarLeitura('GPS', { instante: agoraMenos(1), latitude: 95, longitude: 139 }, AGORA, LIMITES)).toMatch(/Latitude/);
    expect(validarLeitura('GPS', { instante: agoraMenos(1), latitude: 35, longitude: 200 }, AGORA, LIMITES)).toMatch(/Longitude/);
  });

  it('recusa valor que nao e numero', () => {
    expect(validarLeitura('SISMOGRAFO', { instante: agoraMenos(1) }, AGORA, LIMITES)).toMatch(/amplitude/i);
  });
});

describe('leitura do GeoJSON do USGS', () => {
  const amostra = {
    features: [
      {
        id: 'us7000abcd',
        properties: { mag: 5.6, place: '50 km E of Sendai, Japan', time: 1_788_000_000_000, updated: 1_788_000_600_000, status: 'reviewed' },
        geometry: { coordinates: [141.9, 38.3, 35.2] },
      },
      { id: 'sem-magnitude', properties: { mag: null, time: 1 }, geometry: { coordinates: [140, 36, 10] } },
      { id: 'apagado', properties: { mag: 4.6, time: 1_788_000_000_000, status: 'deleted' }, geometry: { coordinates: [140, 36, 10] } },
    ],
  };

  it('converte os campos e descarta itens sem magnitude', () => {
    const eventos = lerGeoJsonUsgs(amostra);
    expect(eventos).toHaveLength(2);
    expect(eventos[0]).toMatchObject({
      idExterno: 'us7000abcd',
      magnitude: 5.6,
      profundidadeKm: 35.2,
      latitude: 38.3,
      longitude: 141.9,
      situacao: 'REVISADO',
    });
  });

  it('marca como cancelado o evento que o USGS apagou', () => {
    expect(lerGeoJsonUsgs(amostra)[1].situacao).toBe('CANCELADO');
  });

  it('entrada invalida vira lista vazia', () => {
    expect(lerGeoJsonUsgs(null)).toEqual([]);
    expect(lerGeoJsonUsgs({})).toEqual([]);
  });
});

describe('regioes do mundo', () => {
  it.each([
    ['Toquio', 35.68, 139.69, 'JAPAO'],
    ['Santiago do Chile', -33.45, -70.66, 'ANDES'],
    ['Reykjavik', 64.15, -21.94, 'ISLANDIA'],
    ['Istambul', 41.0, 28.98, 'MEDITERRANEO'],
    ['Katmandu', 27.7, 85.3, 'HIMALAIA'],
  ])('%s fica em %s', (_nome, latitude, longitude, esperado) => {
    expect(regiaoDoPonto({ latitude, longitude })?.codigo).toBe(esperado);
  });

  it('meio do Atlantico Sul nao pertence a nenhuma regiao', () => {
    expect(regiaoDoPonto({ latitude: -20, longitude: -20 })).toBeUndefined();
  });

  it('so o Japao e monitorado para alertas', () => {
    expect(emRegiaoMonitorada({ latitude: 38.3, longitude: 142.4 })).toBe(true);
    expect(emRegiaoMonitorada({ latitude: -33.45, longitude: -70.66 })).toBe(false);
  });
});
