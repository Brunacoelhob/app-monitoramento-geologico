import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { EstadoAlerta, EventoSismico, NivelAlerta, Prisma, TipoAlerta } from '@prisma/client';
import { UsuarioLogado } from '../auth/decoradores';
import { PrismaService } from '../prisma/prisma.service';
import { regras } from './config';
import { NotificadorService } from './notificador.service';
import { EstacoesService } from './estacoes.service';
import { emRegiaoMonitorada } from './regioes';
import { distanciaKm, ehReplica, estaOnline, nivelPorMagnitude } from './regras';

export interface FiltrosAlertas {
  estado?: EstadoAlerta;
  nivel?: NivelAlerta;
  tipo?: TipoAlerta;
  pagina: number;
  limite: number;
}

@Injectable()
export class AlertasService {
  private readonly log = new Logger(AlertasService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly estacoes: EstacoesService,
    private readonly notificador: NotificadorService,
  ) {}

  // RN-19: toda mudanca guarda quem fez e quando.
  private registrar(alertaId: number, acao: string, detalhes?: string, usuarioId?: number) {
    return this.prisma.alertaHistorico.create({ data: { alertaId, acao, detalhes, usuarioId } });
  }

  private async encerrarAutomatico(alertaId: number, motivo: string) {
    await this.prisma.alerta.update({
      where: { id: alertaId },
      data: { estado: 'ENCERRADO', encerradoEm: new Date(), encerradoAutomatico: true, motivoEncerramento: motivo },
    });
    await this.registrar(alertaId, 'encerrado_automaticamente', motivo);
  }

  // ---------- Regras disparadas por evento (RN-16, RN-17, RN-21) ----------

  // Chamado sempre que um evento e criado ou atualizado. E idempotente:
  // reprocessar o mesmo evento nunca cria um segundo alerta (RN-16).
  async processarEvento(evento: EventoSismico): Promise<void> {
    // Sismos fora das regioes monitoradas (hoje, so o Japao) aparecem nos mapas, mas nao geram alerta.
    if (!emRegiaoMonitorada(evento)) return;

    const existente = await this.prisma.alerta.findUnique({ where: { eventoId: evento.id } });
    const nivel = nivelPorMagnitude(evento.magnitude);
    const aberto = existente !== null && existente.estado !== 'ENCERRADO';

    // RN-17: evento cancelado pela fonte encerra o alerta.
    if (evento.situacao === 'CANCELADO') {
      if (aberto) await this.encerrarAutomatico(existente.id, 'Evento cancelado pelo USGS.');
      return;
    }

    // Magnitude revisada para baixo do limite de alerta (4,5): tambem encerra.
    if (nivel === null) {
      if (aberto) await this.encerrarAutomatico(existente.id, 'Magnitude revisada para abaixo de 4,5.');
      return;
    }

    // RN-17: o nivel mudou com a revisao -> reclassifica e guarda o anterior.
    if (existente) {
      if (aberto && existente.nivel !== nivel) {
        await this.prisma.alerta.update({
          where: { id: existente.id },
          data: { nivel, nivelAnterior: existente.nivel },
        });
        await this.registrar(
          existente.id,
          'nivel_alterado',
          `De ${existente.nivel} para ${nivel} (magnitude revisada para ${evento.magnitude.toFixed(1)}).`,
        );
      }
      return;
    }

    // RN-21: e replica de um alerta que ainda esta aberto?
    if (evento.alertaReplicaId === null) {
      const cfg = regras();
      const janela = new Date(evento.ocorridoEm.getTime() - cfg.replicaHoras * 3_600_000);
      const candidatos = await this.prisma.alerta.findMany({
        where: {
          tipo: 'SISMO',
          estado: { not: 'ENCERRADO' },
          evento: { id: { not: evento.id }, ocorridoEm: { gte: janela, lte: evento.ocorridoEm } },
        },
        include: { evento: true },
      });
      const principal = candidatos.find((a) => a.evento && ehReplica(evento, a.evento, cfg));
      if (principal) {
        await this.prisma.eventoSismico.update({ where: { id: evento.id }, data: { alertaReplicaId: principal.id } });
        await this.registrar(
          principal.id,
          'replica_anexada',
          `Réplica M${evento.magnitude.toFixed(1)}: ${evento.local}.`,
        );
        return;
      }
    } else {
      return; // ja estava anexado como replica
    }

    try {
      const alerta = await this.prisma.alerta.create({
        data: {
          tipo: 'SISMO',
          nivel,
          titulo: `M${evento.magnitude.toFixed(1)} - ${evento.local}`,
          eventoId: evento.id,
          // O alerta "nasce" quando o sismo aconteceu: e dai que contam as 72 h do nivel Atencao (RN-20).
          abertoEm: evento.ocorridoEm,
        },
      });
      await this.registrar(alerta.id, 'aberto', 'Gerado automaticamente a partir do evento.');
      void this.notificador.alertaAberto(alerta, evento); // sem await: o webhook nao atrasa o processamento
    } catch (erro) {
      // Duas execucoes ao mesmo tempo: a segunda bate no indice unico e e ignorada.
      if (!(erro instanceof Prisma.PrismaClientKnownRequestError && erro.code === 'P2002')) throw erro;
    }
  }

  // ---------- Tarefas periodicas (RN-20, RN-22) ----------

  async encerrarAtencaoVencidos(): Promise<number> {
    const { encerramentoAtencaoHoras } = regras();
    const limite = new Date(Date.now() - encerramentoAtencaoHoras * 3_600_000);
    const vencidos = await this.prisma.alerta.findMany({
      where: { tipo: 'SISMO', nivel: 'ATENCAO', estado: { not: 'ENCERRADO' }, abertoEm: { lt: limite } },
      select: { id: true },
    });
    for (const { id } of vencidos) {
      await this.encerrarAutomatico(id, `Encerrado automaticamente após ${encerramentoAtencaoHoras} horas.`);
    }
    return vencidos.length;
  }

  async verificarSemComunicacao(): Promise<number> {
    const { semComunicacaoMinutos } = regras();
    const agora = new Date();
    const [estacoes, ultimas] = await Promise.all([
      this.prisma.estacao.findMany({
        where: { ativa: true, monitoraComunicacao: true },
        include: { alertas: { where: { tipo: 'SEM_COMUNICACAO', estado: { not: 'ENCERRADO' } }, take: 1 } },
      }),
      this.estacoes.ultimaLeituraPorEstacao(),
    ]);

    let abertos = 0;
    for (const estacao of estacoes) {
      if (estacao.alertas.length > 0) continue;
      // Estacao nova sem leituras: a contagem do silencio comeca na criacao.
      const referencia = ultimas.get(estacao.id) ?? estacao.criadaEm;
      if (estaOnline(referencia, agora, semComunicacaoMinutos)) continue;

      const alerta = await this.prisma.alerta.create({
        data: {
          tipo: 'SEM_COMUNICACAO',
          nivel: 'ATENCAO',
          titulo: `Sem comunicação: ${estacao.nome}`,
          estacaoId: estacao.id,
        },
      });
      await this.registrar(alerta.id, 'aberto', `Nenhuma leitura há mais de ${semComunicacaoMinutos} minutos.`);
      abertos++;
    }
    return abertos;
  }

  // RN-22: a primeira leitura recebida encerra o alerta de silencio.
  async restabelecerComunicacao(estacaoId: number): Promise<void> {
    const abertos = await this.prisma.alerta.findMany({
      where: { tipo: 'SEM_COMUNICACAO', estacaoId, estado: { not: 'ENCERRADO' } },
      select: { id: true },
    });
    for (const { id } of abertos) await this.encerrarAutomatico(id, 'Comunicação restabelecida.');
  }

  // ---------- Consultas ----------

  async listar(filtros: FiltrosAlertas) {
    const where: Prisma.AlertaWhereInput = {
      ...(filtros.estado ? { estado: filtros.estado } : {}),
      ...(filtros.nivel ? { nivel: filtros.nivel } : {}),
      ...(filtros.tipo ? { tipo: filtros.tipo } : {}),
    };
    const [total, itens] = await Promise.all([
      this.prisma.alerta.count({ where }),
      this.prisma.alerta.findMany({
        where,
        orderBy: { abertoEm: 'desc' },
        skip: (filtros.pagina - 1) * filtros.limite,
        take: filtros.limite,
        include: {
          evento: { select: { magnitude: true, profundidadeKm: true, local: true, ocorridoEm: true, origem: true } },
          estacao: { select: { id: true, nome: true, origem: true } },
          _count: { select: { replicas: true } },
        },
      }),
    ]);
    return { total, pagina: filtros.pagina, limite: filtros.limite, itens };
  }

  // Detalhe: evento, replicas, historico e as estacoes proximas (RN-15, calculadas na hora).
  async obter(id: number) {
    const alerta = await this.prisma.alerta.findUnique({
      where: { id },
      include: {
        evento: true,
        estacao: { select: { id: true, nome: true, origem: true } },
        replicas: { orderBy: { ocorridoEm: 'asc' } },
        historico: { orderBy: { criadoEm: 'asc' } },
      },
    });
    if (!alerta) throw new NotFoundException('Alerta não encontrado.');

    let estacoesProximas: { id: number; codigo: string; nome: string; origem: string; distanciaKm: number }[] = [];
    if (alerta.evento) {
      const { distanciaProximaKm } = regras();
      const evento = alerta.evento;
      const estacoes = await this.prisma.estacao.findMany({
        where: { ativa: true, latitude: { not: null }, longitude: { not: null } },
      });
      estacoesProximas = estacoes
        .map((e) => ({
          id: e.id,
          codigo: e.codigo,
          nome: e.nome,
          origem: e.origem as string,
          distanciaKm: Math.round(distanciaKm(evento, { latitude: e.latitude!, longitude: e.longitude! })),
        }))
        .filter((e) => e.distanciaKm <= distanciaProximaKm)
        .sort((a, b) => a.distanciaKm - b.distanciaKm);
    }
    return { ...alerta, estacoesProximas };
  }

  // ---------- Acoes do admin (RN-18, RN-19) ----------

  async reconhecer(id: number, usuario: UsuarioLogado) {
    const alerta = await this.prisma.alerta.findUnique({ where: { id } });
    if (!alerta) throw new NotFoundException('Alerta não encontrado.');
    if (alerta.estado !== 'ABERTO') throw new ConflictException('Só alertas abertos podem ser reconhecidos.');

    await this.prisma.alerta.update({
      where: { id },
      data: { estado: 'RECONHECIDO', reconhecidoEm: new Date(), reconhecidoPorId: usuario.id },
    });
    await this.registrar(id, 'reconhecido', undefined, usuario.id);
    return this.obter(id);
  }

  async encerrar(id: number, usuario: UsuarioLogado, motivo?: string) {
    const alerta = await this.prisma.alerta.findUnique({ where: { id } });
    if (!alerta) throw new NotFoundException('Alerta não encontrado.');
    if (alerta.estado === 'ENCERRADO') throw new ConflictException('Este alerta já está encerrado.');

    const texto = motivo?.trim();
    // RN-18: encerrar sem reconhecer antes exige dizer por que.
    if (alerta.estado === 'ABERTO' && !texto) {
      throw new BadRequestException('Informe o motivo para encerrar um alerta que ainda não foi reconhecido.');
    }

    await this.prisma.alerta.update({
      where: { id },
      data: { estado: 'ENCERRADO', encerradoEm: new Date(), encerradoPorId: usuario.id, motivoEncerramento: texto || null },
    });
    await this.registrar(id, 'encerrado', texto, usuario.id);
    return this.obter(id);
  }
}
