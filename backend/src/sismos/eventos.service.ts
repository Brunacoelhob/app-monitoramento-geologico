import { Injectable, NotFoundException } from '@nestjs/common';
import { NivelAlerta, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { LIMITE_ALTO, LIMITE_ATENCAO, LIMITE_CRITICO, regras } from './config';
import { ConsultaEventosDto, FiltrosEventosDto } from './dto/eventos.dto';
import { EstacoesService } from './estacoes.service';
import { REGIOES, regiaoPorCodigo } from './regioes';
import { estaOnline } from './regras';

// Faixa de magnitude de cada nivel (RN-13): [minimo, maximo)
const FAIXA: Record<NivelAlerta, [number, number]> = {
  ATENCAO: [LIMITE_ATENCAO, LIMITE_ALTO],
  ALTO: [LIMITE_ALTO, LIMITE_CRITICO],
  CRITICO: [LIMITE_CRITICO, 100],
};

// Distancia pela superficie da Terra em SQL (mesma formula do haversine em regras.ts).
const distanciaSql = (lat: number, lon: number) => Prisma.sql`(
  12742 * asin(sqrt(
    power(sin(radians(e.latitude - ${lat}) / 2), 2) +
    cos(radians(${lat})) * cos(radians(e.latitude)) * power(sin(radians(e.longitude - ${lon}) / 2), 2)
  ))
)`;

@Injectable()
export class EventosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly estacoes: EstacoesService,
  ) {}

  // Monta o WHERE comum (consulta parametrizada). "fim" inclui o dia inteiro.
  async filtroSql(f: FiltrosEventosDto): Promise<Prisma.Sql> {
    const condicoes: Prisma.Sql[] = [];
    if (f.inicio) condicoes.push(Prisma.sql`e.ocorrido_em >= ${new Date(f.inicio)}`);
    if (f.fim) condicoes.push(Prisma.sql`e.ocorrido_em < ${new Date(new Date(f.fim).getTime() + 86_400_000)}`);
    if (f.magnitudeMin !== undefined) condicoes.push(Prisma.sql`e.magnitude >= ${f.magnitudeMin}`);
    if (f.nivel) {
      const [min, max] = FAIXA[f.nivel];
      condicoes.push(Prisma.sql`e.magnitude >= ${min} AND e.magnitude < ${max}`);
    }
    if (f.origem) condicoes.push(Prisma.sql`e.origem = ${f.origem}::"Origem"`);
    condicoes.push(f.situacao ? Prisma.sql`e.situacao = ${f.situacao}::"SituacaoEvento"` : Prisma.sql`e.situacao <> 'CANCELADO'`);

    if (f.regiao) {
      const r = regiaoPorCodigo(f.regiao)!;
      condicoes.push(Prisma.sql`e.latitude BETWEEN ${r.latMin} AND ${r.latMax} AND e.longitude BETWEEN ${r.lonMin} AND ${r.lonMax}`);
    }

    if (f.estacaoId !== undefined) {
      const estacao = await this.prisma.estacao.findUnique({ where: { id: f.estacaoId } });
      if (!estacao) throw new NotFoundException('Estação não encontrada.');
      if (estacao.latitude === null || estacao.longitude === null) {
        condicoes.push(Prisma.sql`FALSE`); // estacao sem posicao (ex.: legado) nao tem eventos "proximos"
      } else {
        condicoes.push(Prisma.sql`${distanciaSql(estacao.latitude, estacao.longitude)} <= ${regras().distanciaProximaKm}`);
      }
    }
    return Prisma.sql`WHERE ${Prisma.join(condicoes, ' AND ')}`;
  }

  async listar(consulta: ConsultaEventosDto) {
    const where = await this.filtroSql(consulta);
    const [contagem, itens] = await Promise.all([
      this.prisma.$queryRaw<{ total: bigint }[]>`SELECT COUNT(*) AS total FROM eventos_sismicos e ${where}`,
      this.prisma.$queryRaw<Record<string, unknown>[]>`
        SELECT e.id, e.id_externo AS "idExterno", e.magnitude, e.profundidade_km AS "profundidadeKm",
               e.latitude, e.longitude, e.local, e.ocorrido_em AS "ocorridoEm",
               e.origem::text AS origem, e.situacao::text AS situacao,
               a.id AS "alertaId", a.nivel::text AS "alertaNivel", a.estado::text AS "alertaEstado",
               e.alerta_replica_id AS "replicaDoAlertaId"
        FROM eventos_sismicos e LEFT JOIN alertas a ON a.evento_id = e.id
        ${where}
        ORDER BY e.ocorrido_em DESC
        LIMIT ${consulta.limite} OFFSET ${(consulta.pagina - 1) * consulta.limite}`,
    ]);
    return { total: Number(contagem[0].total), pagina: consulta.pagina, limite: consulta.limite, itens };
  }

  // Pontos do mapa: versao enxuta, ate 2000 eventos.
  async mapa(filtros: FiltrosEventosDto) {
    const where = await this.filtroSql(filtros);
    return this.prisma.$queryRaw<Record<string, unknown>[]>`
      SELECT e.id, e.magnitude, e.profundidade_km AS "profundidadeKm", e.latitude, e.longitude,
             e.local, e.ocorrido_em AS "ocorridoEm", e.origem::text AS origem
      FROM eventos_sismicos e ${where}
      ORDER BY e.ocorrido_em DESC LIMIT 2000`;
  }

  // RN-24: indicadores do painel.
  async totais(filtros: FiltrosEventosDto) {
    const where = await this.filtroSql(filtros);
    const [resumo, alertasAbertos, estacoes, ultimas] = await Promise.all([
      this.prisma.$queryRaw<
        { total: bigint; maior: number | null; atencao: bigint; alto: bigint; critico: bigint; registro: bigint }[]
      >`
        SELECT COUNT(*) AS total, MAX(e.magnitude) AS maior,
               COUNT(*) FILTER (WHERE e.magnitude >= ${LIMITE_ATENCAO} AND e.magnitude < ${LIMITE_ALTO}) AS atencao,
               COUNT(*) FILTER (WHERE e.magnitude >= ${LIMITE_ALTO} AND e.magnitude < ${LIMITE_CRITICO}) AS alto,
               COUNT(*) FILTER (WHERE e.magnitude >= ${LIMITE_CRITICO}) AS critico,
               COUNT(*) FILTER (WHERE e.magnitude < ${LIMITE_ATENCAO}) AS registro
        FROM eventos_sismicos e ${where}`,
      this.prisma.alerta.groupBy({ by: ['nivel'], where: { estado: { not: 'ENCERRADO' } }, _count: true }),
      this.prisma.estacao.findMany({ where: { ativa: true, monitoraComunicacao: true }, select: { id: true } }),
      this.estacoes.ultimaLeituraPorEstacao(),
    ]);

    const r = resumo[0];
    const agora = new Date();
    const { semComunicacaoMinutos } = regras();
    const conta = (nivel: NivelAlerta) => alertasAbertos.find((a) => a.nivel === nivel)?._count ?? 0;

    return {
      totalEventos: Number(r.total),
      maiorMagnitude: r.maior,
      porNivel: { REGISTRO: Number(r.registro), ATENCAO: Number(r.atencao), ALTO: Number(r.alto), CRITICO: Number(r.critico) },
      alertasAbertos: { ATENCAO: conta('ATENCAO'), ALTO: conta('ALTO'), CRITICO: conta('CRITICO') },
      estacoes: {
        ativas: estacoes.length,
        online: estacoes.filter((e) => estaOnline(ultimas.get(e.id) ?? null, agora, semComunicacaoMinutos)).length,
      },
    };
  }

  // Quantidade e maior magnitude por dia (UTC): base dos graficos.
  async serieDiaria(filtros: FiltrosEventosDto) {
    const where = await this.filtroSql(filtros);
    const linhas = await this.prisma.$queryRaw<{ dia: string; eventos: bigint; maior: number }[]>`
      SELECT to_char(date_trunc('day', e.ocorrido_em AT TIME ZONE 'UTC'), 'YYYY-MM-DD') AS dia,
             COUNT(*) AS eventos, MAX(e.magnitude) AS maior
      FROM eventos_sismicos e ${where} GROUP BY 1 ORDER BY 1`;
    return linhas.map((l) => ({ dia: l.dia, eventos: Number(l.eventos), maiorMagnitude: l.maior }));
  }

  async periodo() {
    const { _min, _max } = await this.prisma.eventoSismico.aggregate({
      where: { situacao: { not: 'CANCELADO' } },
      _min: { ocorridoEm: true },
      _max: { ocorridoEm: true },
    });
    return { inicio: _min.ocorridoEm, fim: _max.ocorridoEm };
  }

  // Quantos sismos (e a maior magnitude) em cada regiao do mundo: pinta o mapa-mundi clicavel.
  // Usa todos os filtros, menos a propria regiao (senao so uma regiao teria numeros).
  async regioes(filtros: FiltrosEventosDto) {
    const where = await this.filtroSql({ ...filtros, regiao: undefined });
    const dentro = (r: (typeof REGIOES)[number]) =>
      Prisma.sql`e.latitude BETWEEN ${r.latMin} AND ${r.latMax} AND e.longitude BETWEEN ${r.lonMin} AND ${r.lonMax}`;
    const colunas = REGIOES.flatMap((r, i) => [
      Prisma.sql`COUNT(*) FILTER (WHERE ${dentro(r)}) AS ${Prisma.raw(`n${i}`)}`,
      Prisma.sql`MAX(e.magnitude) FILTER (WHERE ${dentro(r)}) AS ${Prisma.raw(`m${i}`)}`,
    ]);
    const [linha] = await this.prisma.$queryRaw<Record<string, bigint | number | null>[]>`
      SELECT COUNT(*) AS total, ${Prisma.join(colunas)} FROM eventos_sismicos e ${where}`;

    return {
      total: Number(linha['total']),
      regioes: REGIOES.map((r, i) => ({
        ...r,
        eventos: Number(linha[`n${i}`] ?? 0),
        maiorMagnitude: (linha[`m${i}`] as number | null) ?? null,
      })),
    };
  }
}
