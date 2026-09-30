import { DatePipe } from '@angular/common';
import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { RouterLink } from '@angular/router';
import { MapaSismos } from '../../compartilhado/mapa-sismos/mapa-sismos';
import { SeloNivel } from '../../compartilhado/selo-nivel/selo-nivel';
import { SeloOrigem } from '../../compartilhado/selo-origem/selo-origem';
import { mensagemDeErro } from '../../core/arquivo';
import { AuthServico } from '../../core/auth.servico';
import { EstacoesServico } from '../../core/estacoes.servico';
import { AlertaDetalhe as Detalhe, PontoMapa } from '../../core/modelos';
import { FUSO_JAPAO, dataJst } from '../../core/nivel';
import { SismosServico } from '../../core/sismos.servico';
import { EncerrarAlertaDialog } from './encerrar-alerta-dialog/encerrar-alerta-dialog';

const ACOES: Record<string, string> = {
  aberto: 'Alerta aberto',
  reconhecido: 'Reconhecido',
  encerrado: 'Encerrado',
  encerrado_automaticamente: 'Encerrado automaticamente',
  replica_anexada: 'Réplica anexada',
  nivel_alterado: 'Nível alterado',
};

@Component({
  selector: 'app-alerta-detalhe',
  imports: [DatePipe, MatButtonModule, RouterLink, MapaSismos, SeloNivel, SeloOrigem],
  templateUrl: './alerta-detalhe.html',
  styleUrl: './alerta-detalhe.scss',
})
export class AlertaDetalhe {
  // Vem da rota /alertas/:id (withComponentInputBinding)
  readonly id = input.required<string>();

  private readonly sismos = inject(SismosServico);
  private readonly dialogo = inject(MatDialog);
  private readonly aviso = inject(MatSnackBar);
  protected readonly auth = inject(AuthServico);
  protected readonly estacoes = inject(EstacoesServico);

  protected readonly alerta = signal<Detalhe | null>(null);
  protected readonly erro = signal(false);
  protected readonly ocupado = signal(false);
  protected readonly fuso = FUSO_JAPAO;
  protected readonly dataJst = dataJst;
  protected readonly acoes = ACOES;

  protected readonly ehAdmin = computed(() => this.auth.usuario()?.papel === 'ADMIN');
  protected readonly pontoMapa = computed<PontoMapa[]>(() => {
    const e = this.alerta()?.evento;
    return e && e.latitude !== undefined && e.longitude !== undefined
      ? [{ id: e.id, magnitude: e.magnitude, profundidadeKm: e.profundidadeKm, latitude: e.latitude, longitude: e.longitude, local: e.local, ocorridoEm: e.ocorridoEm, origem: e.origem }]
      : [];
  });

  constructor() {
    this.estacoes.carregar().subscribe({ error: () => undefined });
    effect(() => this.carregar(Number(this.id())));
  }

  private carregar(id: number) {
    this.erro.set(false);
    this.sismos.alerta(id).subscribe({ next: (a) => this.alerta.set(a), error: () => this.erro.set(true) });
  }

  protected reconhecer() {
    const a = this.alerta();
    if (!a) return;
    this.executar(this.sismos.reconhecer(a.id), 'Alerta reconhecido.');
  }

  protected encerrar() {
    const a = this.alerta();
    if (!a) return;
    this.dialogo
      .open(EncerrarAlertaDialog, { data: { titulo: a.titulo, obrigatorio: a.estado === 'ABERTO' }, maxWidth: '92vw' })
      .afterClosed()
      .subscribe((motivo: string | undefined) => {
        if (motivo !== undefined) this.executar(this.sismos.encerrar(a.id, motivo || undefined), 'Alerta encerrado.');
      });
  }

  private executar(chamada: ReturnType<SismosServico['reconhecer']>, sucesso: string) {
    this.ocupado.set(true);
    chamada.subscribe({
      next: (a) => {
        this.alerta.set(a);
        this.ocupado.set(false);
        this.aviso.open(sucesso, 'Ok', { duration: 4000 });
      },
      error: async (erro: unknown) => {
        this.ocupado.set(false);
        this.aviso.open(await mensagemDeErro(erro, 'Não foi possível concluir a ação.'), 'Fechar', { duration: 6000 });
      },
    });
  }
}
