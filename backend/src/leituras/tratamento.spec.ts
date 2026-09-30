import { Sentido } from '@prisma/client';
import { converterData, removerIdsRepetidos, tratarLinha } from './tratamento';

const linhaBase = {
  id: 'a',
  'room_id/id': 'Room Admin',
  noted_date: '08-12-2018 09:30',
  temp: '29',
  'out/in': 'In',
};

describe('tratamento', () => {
  it('converte e renomeia uma linha valida', () => {
    const leitura = tratarLinha(linhaBase);
    expect(leitura.sentido).toBe(Sentido.INTERNO);
    expect(leitura.temperatura).toBe(29);
    expect(leitura.dataLeitura.toISOString()).toBe('2018-12-08T09:30:00.000Z');
  });

  it('rejeita sentido invalido', () => {
    expect(() => tratarLinha({ ...linhaBase, 'out/in': 'X' })).toThrow('Sentido invalido');
  });

  it('rejeita temperatura invalida', () => {
    expect(() => tratarLinha({ ...linhaBase, temp: 'abc' })).toThrow('Temperatura invalida');
  });

  it('rejeita data inexistente e formato errado', () => {
    expect(() => converterData('31-02-2018 10:00')).toThrow('inexistente');
    expect(() => converterData('2018-12-08')).toThrow('Data invalida');
  });

  it('remove so ids repetidos e mantem leituras iguais com ids diferentes', () => {
    const a = tratarLinha(linhaBase);
    const b = tratarLinha({ ...linhaBase, id: 'b' });
    expect(removerIdsRepetidos([a, a, b])).toHaveLength(2);
  });
});
