import { analisarBlocoSse } from './tempo-real.servico';

describe('analisarBlocoSse', () => {
  it('lê o tipo e os dados de um aviso de alerta', () => {
    expect(analisarBlocoSse('event: alerta\nid: 7\ndata: {"id":37,"acao":"aberto"}')).toEqual({
      tipo: 'alerta',
      dados: { id: 37, acao: 'aberto' },
    });
  });

  it.each(['sismos', 'leituras'])('reconhece o tipo %s', (tipo) => {
    expect(analisarBlocoSse(`event: ${tipo}\ndata: {}`)?.tipo).toBe(tipo);
  });

  it('ignora batimento, conexão e tipos desconhecidos', () => {
    expect(analisarBlocoSse('event: ping\ndata: {}')).toBeNull();
    expect(analisarBlocoSse('event: conectado\nid: 1\ndata: {}')).toBeNull();
    expect(analisarBlocoSse('event: outro\ndata: {}')).toBeNull();
    expect(analisarBlocoSse(': comentario')).toBeNull();
  });

  it('JSON quebrado não derruba o canal', () => {
    expect(analisarBlocoSse('event: alerta\ndata: {quebrado')).toBeNull();
  });

  it('aviso sem dados vira objeto vazio', () => {
    expect(analisarBlocoSse('event: leituras')).toEqual({ tipo: 'leituras', dados: {} });
  });
});
