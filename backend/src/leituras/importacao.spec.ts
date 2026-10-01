import { CsvInvalidoError, MAX_LINHAS_IMPORTACAO, MODELO_CSV, lerCsvLeituras, lerData } from './importacao';

const AGORA = new Date('2026-09-30T12:00:00Z');
const ler = (csv: string) => lerCsvLeituras(csv, AGORA);

describe('lerData', () => {
  it.each([
    ['29/09/2026 14:30', '2026-09-29T14:30:00.000Z'],
    ['29/09/2026 14:30:15', '2026-09-29T14:30:15.000Z'],
    ['29/09/2026', '2026-09-29T00:00:00.000Z'],
    ['29-09-2026 14:30', '2026-09-29T14:30:00.000Z'], // formato do dataset original
    ['2026-09-29 14:30', '2026-09-29T14:30:00.000Z'],
    ['2026-09-29T14:30:00Z', '2026-09-29T14:30:00.000Z'],
    ['2026-09-29T11:30:00-03:00', '2026-09-29T14:30:00.000Z'],
    ['2026-09-29T11:30:00-0300', '2026-09-29T14:30:00.000Z'],
  ])('%s', (texto, esperado) => {
    expect(lerData(texto).toISOString()).toBe(esperado);
  });

  it('rejeita datas inexistentes e formatos desconhecidos', () => {
    expect(() => lerData('31/02/2026 10:00')).toThrow('inexistente');
    expect(() => lerData('2026-02-31')).toThrow('invalida');
    expect(() => lerData('ontem')).toThrow('invalida');
  });
});

describe('lerCsvLeituras', () => {
  it('lê o modelo oferecido para download sem nenhum erro', () => {
    const r = ler(MODELO_CSV);
    expect(r.erros).toEqual([]);
    expect(r.validas).toHaveLength(3);
    expect(r.validas[0]).toMatchObject({ sala: 'Sala de servidores', temperatura: 22.4, sentido: 'INTERNO', linha: 2 });
    expect(r.validas[2].id).toBe('leitura-0003');
  });

  it('aceita as colunas do dataset original (room_id/id, noted_date, temp, out/in)', () => {
    const r = ler('id,room_id/id,noted_date,temp,out/in\nx1,Admin,08-12-2018 09:30,29,In\nx2,Admin,08-12-2018 09:31,35,Out');
    expect(r.erros).toEqual([]);
    expect(r.validas.map((l) => l.sentido)).toEqual(['INTERNO', 'EXTERNO']);
    expect(r.validas[0].dataLeitura.toISOString()).toBe('2018-12-08T09:30:00.000Z');
  });

  it('detecta o separador (; ou ,), ignora BOM, acentos e maiúsculas no cabeçalho', () => {
    const r = ler('﻿SALA;Data_Leitura;Temperatura;Sentido\nSala A;29/09/2026 10:00;21,5;externo');
    expect(r.erros).toEqual([]);
    expect(r.validas[0]).toMatchObject({ sala: 'Sala A', temperatura: 21.5, sentido: 'EXTERNO' });
  });

  it('arredonda a temperatura para 1 casa decimal', () => {
    expect(ler('sala,data_leitura,temperatura,sentido\nA,29/09/2026 10:00,22.449,INTERNO').validas[0].temperatura).toBe(22.4);
  });

  it('linhas ruins são recusadas com o número da linha e o motivo; as boas continuam', () => {
    const r = ler(
      [
        'sala,data_leitura,temperatura,sentido',
        'A,29/09/2026 10:00,22,INTERNO', // 2: ok
        ',29/09/2026 10:00,22,INTERNO', // 3: sala vazia
        'A,29/09/2026 10:00,abc,INTERNO', // 4: temperatura invalida
        'A,29/09/2026 10:00,999,INTERNO', // 5: fora da faixa
        'A,29/09/2026 10:00,22,lateral', // 6: sentido invalido
        'A,31/02/2026 10:00,22,INTERNO', // 7: data inexistente
        'A,01/01/2027 10:00,22,INTERNO', // 8: futuro
        'A,29/09/2026 10:00,22,EXTERNO', // 9: ok
      ].join('\n'),
    );
    expect(r.validas.map((l) => l.linha)).toEqual([2, 9]);
    expect(r.erros.map((e) => e.linha)).toEqual([3, 4, 5, 6, 7, 8]);
    expect(r.erros[0].motivo).toContain('Sala em branco');
    expect(r.erros[2].motivo).toContain('fora da faixa');
    expect(r.erros[5].motivo).toContain('futuro');
  });

  it('id repetido no arquivo é ignorado (conta à parte), sem virar erro', () => {
    const r = ler('id,sala,data_leitura,temperatura,sentido\na,S,29/09/2026 10:00,20,INTERNO\na,S,29/09/2026 10:01,21,INTERNO\nb,S,29/09/2026 10:02,22,INTERNO');
    expect(r.validas).toHaveLength(2);
    expect(r.repetidasNoArquivo).toBe(1);
    expect(r.erros).toEqual([]);
  });

  it('cabeçalho sem colunas obrigatórias, arquivo vazio e só cabeçalho dão erro claro', () => {
    expect(() => ler('foo,bar\n1,2')).toThrow(CsvInvalidoError);
    expect(() => ler('foo,bar\n1,2')).toThrow('faltam as colunas sala, data_leitura, temperatura, sentido');
    expect(() => ler('')).toThrow('vazio');
    expect(() => ler('sala,data_leitura,temperatura,sentido\n')).toThrow('só o cabeçalho');
  });

  it('recusa arquivos acima do limite de linhas', () => {
    const linhas = Array.from({ length: MAX_LINHAS_IMPORTACAO + 1 }, (_, i) => `A,29/09/2026 10:${String(i % 60).padStart(2, '0')},20,INTERNO`);
    expect(() => ler(['sala,data_leitura,temperatura,sentido', ...linhas].join('\n'))).toThrow('máximo por importação');
  });
});
