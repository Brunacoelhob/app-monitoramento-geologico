import { Alerta, EventoSismico } from '@prisma/client';
import { NotificadorService } from './notificador.service';

const evento = {
  id: 1, idExterno: 'x', magnitude: 6.1, profundidadeKm: 30, latitude: 38, longitude: 142,
  local: '48 km E of Ishinomaki, Japan', ocorridoEm: new Date('2026-09-29T19:45:00Z'),
} as EventoSismico;
const alerta = (nivel: Alerta['nivel']) => ({ id: 7, nivel, titulo: 'M6.1 - Japan' }) as Alerta;

describe('NotificadorService', () => {
  const fetchOriginal = global.fetch;
  let fetchFalso: jest.Mock;
  const servico = new NotificadorService();

  beforeEach(() => {
    fetchFalso = jest.fn().mockResolvedValue({ ok: true, status: 200 });
    global.fetch = fetchFalso as unknown as typeof fetch;
    process.env.ALERTA_WEBHOOK_URL = 'https://exemplo.test/webhook';
  });
  afterEach(() => {
    global.fetch = fetchOriginal;
    delete process.env.ALERTA_WEBHOOK_URL;
  });

  it('envia alerta ALTO com texto legível e dados estruturados', async () => {
    await servico.alertaAberto(alerta('ALTO'), evento);
    expect(fetchFalso).toHaveBeenCalledTimes(1);
    const [url, opcoes] = fetchFalso.mock.calls[0];
    expect(url).toBe('https://exemplo.test/webhook');
    const corpo = JSON.parse(opcoes.body);
    expect(corpo.text).toContain('Alerta alto');
    expect(corpo.text).toContain('M6,1');
    expect(corpo.content).toBe(corpo.text); // Discord usa "content"
    expect(corpo.alerta).toMatchObject({ id: 7, nivel: 'ALTO', magnitude: 6.1 });
  });

  it('alerta CRITICO também é enviado', async () => {
    await servico.alertaAberto(alerta('CRITICO'), evento);
    expect(JSON.parse(fetchFalso.mock.calls[0][1].body).text).toContain('CRÍTICO');
  });

  it('alerta ATENCAO não é enviado', async () => {
    await servico.alertaAberto(alerta('ATENCAO'), evento);
    expect(fetchFalso).not.toHaveBeenCalled();
  });

  it('sem ALERTA_WEBHOOK_URL não faz nada', async () => {
    delete process.env.ALERTA_WEBHOOK_URL;
    await servico.alertaAberto(alerta('ALTO'), evento);
    expect(fetchFalso).not.toHaveBeenCalled();
  });

  it('falha de rede ou resposta de erro nunca lança exceção', async () => {
    fetchFalso.mockRejectedValueOnce(new Error('sem rede'));
    await expect(servico.alertaAberto(alerta('ALTO'), evento)).resolves.toBeUndefined();
    fetchFalso.mockResolvedValueOnce({ ok: false, status: 500 });
    await expect(servico.alertaAberto(alerta('ALTO'), evento)).resolves.toBeUndefined();
  });
});
