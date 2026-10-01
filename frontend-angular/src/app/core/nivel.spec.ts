import { dataJst, nivelDe } from './nivel';

describe('nivelDe (mesmos limites do backend, RN-13)', () => {
  it.each([
    [4.4, 'REGISTRO'],
    [4.5, 'ATENCAO'],
    [5.4, 'ATENCAO'],
    [5.5, 'ALTO'],
    [6.4, 'ALTO'],
    [6.5, 'CRITICO'],
    [8.9, 'CRITICO'],
  ])('magnitude %s é %s', (magnitude, esperado) => {
    expect(nivelDe(magnitude)).toBe(esperado);
  });
});

describe('dataJst (RN-28: horário do Japão)', () => {
  it('converte o instante UTC para JST (UTC+9) e marca o fuso', () => {
    // Algumas versoes do ICU separam data e hora com virgula, outras nao
    expect(dataJst('2026-09-29T19:45:00.000Z')).toMatch(/^30\/09\/2026,? 04:45 JST$/);
  });
});
