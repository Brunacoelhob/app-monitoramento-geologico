import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Subject, of } from 'rxjs';
import { AlarmeServico } from './alarme.servico';
import { AuthServico } from './auth.servico';
import { AlertaResumo, PaginaAlertas } from './modelos';
import { SismosServico } from './sismos.servico';
import { AvisoTempoReal, TempoRealServico } from './tempo-real.servico';

const alerta = (id: number, nivel: AlertaResumo['nivel'], abertoEm: string): AlertaResumo => ({
  id, tipo: 'SISMO', nivel, nivelAnterior: null, estado: 'ABERTO', titulo: `Alerta ${id}`, abertoEm,
  encerradoEm: null, encerradoAutomatico: false, motivoEncerramento: null, evento: null, estacao: null, _count: { replicas: 0 },
});

function preparar(itens: AlertaResumo[], autenticado = true) {
  const avisos = new Subject<AvisoTempoReal>();
  localStorage.clear();
  const pagina: PaginaAlertas = { total: itens.length, pagina: 1, limite: 50, itens };
  const alertas = vi.fn(() => of(pagina));
  TestBed.configureTestingModule({
    providers: [
      { provide: AuthServico, useValue: { autenticado: signal(autenticado) } },
      { provide: SismosServico, useValue: { alertas } },
      { provide: TempoRealServico, useValue: { avisos$: avisos.asObservable() } },
    ],
  });
  const servico = TestBed.inject(AlarmeServico);
  TestBed.tick(); // executa o effect que busca os alertas
  return { servico, alertas, avisos };
}

describe('AlarmeServico', () => {
  it('mostra o alerta mais grave e, em empate, o mais recente', () => {
    const { servico } = preparar([
      alerta(1, 'ALTO', '2026-09-29T10:00:00Z'),
      alerta(2, 'CRITICO', '2026-09-29T08:00:00Z'),
      alerta(3, 'CRITICO', '2026-09-29T09:00:00Z'),
    ]);
    expect(servico.atual()?.id).toBe(3);
  });

  it('ignora alertas de nível Atenção (só ALTO e CRITICO acendem a luz)', () => {
    const { servico } = preparar([alerta(1, 'ATENCAO', '2026-09-29T10:00:00Z')]);
    expect(servico.atual()).toBeNull();
  });

  it('dispensar esconde o alerta, mostra o próximo e lembra depois de recarregar', () => {
    const { servico } = preparar([alerta(1, 'CRITICO', '2026-09-29T10:00:00Z'), alerta(2, 'ALTO', '2026-09-29T11:00:00Z')]);
    expect(servico.atual()?.id).toBe(1);
    servico.dispensar();
    expect(servico.atual()?.id).toBe(2);
    expect(JSON.parse(localStorage.getItem('iot.alarmes.dispensados') ?? '[]')).toEqual([1]);
  });

  it('não busca alertas sem login', () => {
    const { servico, alertas } = preparar([alerta(1, 'CRITICO', '2026-09-29T10:00:00Z')], false);
    expect(alertas).not.toHaveBeenCalled();
    expect(servico.atual()).toBeNull();
  });

  it('a pré-visualização tem prioridade e dispensá-la não grava nada', () => {
    const { servico } = preparar([]);
    servico.previsualizar('CRITICO');
    expect(servico.atual()?.id).toBe(-1);
    expect(servico.atual()?.nivel).toBe('CRITICO');
    servico.dispensar();
    expect(servico.atual()).toBeNull();
    expect(localStorage.getItem('iot.alarmes.dispensados')).toBeNull();
  });

  it('um aviso de alerta em tempo real busca os alertas na hora', () => {
    const { alertas, avisos } = preparar([]);
    expect(alertas).toHaveBeenCalledTimes(1); // busca inicial
    avisos.next({ tipo: 'alerta', dados: { id: 5, acao: 'aberto' } });
    expect(alertas).toHaveBeenCalledTimes(2);
    avisos.next({ tipo: 'leituras', dados: {} }); // outros tipos nao interessam ao alarme
    expect(alertas).toHaveBeenCalledTimes(2);
  });
});
