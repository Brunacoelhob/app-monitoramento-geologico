import { Injectable, Logger, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AlertasService } from './alertas.service';
import { regras } from './config';
import { SimuladorService } from './simulador.service';
import { UsgsService } from './usgs.service';

// Tarefas em segundo plano. Desligue tudo com SISMOS_AGENDADOR=false (testes, scripts).
@Injectable()
export class AgendadorService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly log = new Logger(AgendadorService.name);
  private readonly timers: NodeJS.Timeout[] = [];

  constructor(
    private readonly prisma: PrismaService,
    private readonly usgs: UsgsService,
    private readonly simulador: SimuladorService,
    private readonly alertas: AlertasService,
  ) {}

  onApplicationBootstrap() {
    const cfg = regras();
    if (!cfg.agendador) {
      this.log.log('Agendador desligado (SISMOS_AGENDADOR=false).');
      return;
    }

    this.agendar('USGS', 10_000, cfg.intervaloUsgsMinutos * 60_000, () => this.usgs.sincronizar());
    this.agendar('simulador', 15_000, 60_000, () => this.simulador.tick());
    // RN-20 e RN-22: verificadas todo minuto.
    this.agendar('alertas', 30_000, 60_000, async () => {
      await this.alertas.encerrarAtencaoVencidos();
      await this.alertas.verificarSemComunicacao();
    });
    // RN-29: retencao das leituras brutas do sismografo.
    this.agendar('retencao', 60_000, 3_600_000, async () => {
      const limite = new Date(Date.now() - regras().retencaoSismografoDias * 86_400_000);
      const { count } = await this.prisma.leituraSismografo.deleteMany({ where: { instante: { lt: limite } } });
      if (count > 0) this.log.log(`Retenção: ${count} leituras de sismógrafo antigas removidas.`);
    });
  }

  onModuleDestroy() {
    this.timers.forEach((t) => clearTimeout(t));
  }

  private agendar(nome: string, primeiraVezMs: number, intervaloMs: number, tarefa: () => Promise<unknown>) {
    const executar = async () => {
      try {
        await tarefa();
      } catch (erro) {
        // Uma tarefa que falha nao derruba as outras nem a API.
        this.log.error(`Tarefa "${nome}" falhou: ${(erro as Error).message}`);
      }
    };
    const inicio = setTimeout(() => {
      void executar();
      const repetir = setInterval(() => void executar(), intervaloMs);
      repetir.unref();
      this.timers.push(repetir);
    }, primeiraVezMs);
    inicio.unref();
    this.timers.push(inicio);
  }
}
