import { ConflictException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ConsultaLeiturasDto } from './dto/consulta-leituras.dto';
import { CriarLeituraDto } from './dto/criar-leitura.dto';

export interface ResumoSentido {
  sentido: string;
  leituras: number;
  media: number;
  minima: number;
  maxima: number;
}

@Injectable()
export class LeiturasService {
  constructor(private readonly prisma: PrismaService) {}

  // Monta o filtro comum. "fim" inclui o dia inteiro (ate 24h depois).
  montarFiltro(consulta: ConsultaLeiturasDto): Prisma.LeituraWhereInput {
    const filtro: Prisma.LeituraWhereInput = {};
    if (consulta.inicio || consulta.fim) {
      filtro.dataLeitura = {};
      if (consulta.inicio) filtro.dataLeitura.gte = new Date(consulta.inicio);
      if (consulta.fim) filtro.dataLeitura.lt = new Date(new Date(consulta.fim).getTime() + 86_400_000);
    }
    if (consulta.sentido) filtro.sentido = consulta.sentido;
    if (consulta.estacaoId !== undefined) filtro.estacaoId = consulta.estacaoId;
    if (consulta.origem) filtro.origem = consulta.origem;
    return filtro;
  }

  async listar(consulta: ConsultaLeiturasDto) {
    const where = this.montarFiltro(consulta);
    const [total, itens] = await Promise.all([
      this.prisma.leitura.count({ where }),
      this.prisma.leitura.findMany({
        where,
        orderBy: { dataLeitura: 'desc' },
        skip: (consulta.pagina - 1) * consulta.limite,
        take: consulta.limite,
      }),
    ]);

    return {
      total,
      pagina: consulta.pagina,
      limite: consulta.limite,
      itens: itens.map((leitura) => ({ ...leitura, temperatura: Number(leitura.temperatura) })),
    };
  }

  // Contagem, media, minima e maxima por sentido (usado nos cards e no relatorio).
  async resumoPorSentido(
    filtro: Pick<ConsultaLeiturasDto, 'inicio' | 'fim' | 'sentido' | 'estacaoId' | 'origem'>,
  ): Promise<ResumoSentido[]> {
    const where = this.filtroSql(filtro);
    const linhas = await this.prisma.$queryRaw<
      { sentido: string; leituras: bigint; media: number; minima: number; maxima: number }[]
    >`
      SELECT sentido::text AS sentido, COUNT(*) AS leituras,
             AVG(temperatura)::float8 AS media, MIN(temperatura)::float8 AS minima,
             MAX(temperatura)::float8 AS maxima
      FROM leituras_temperatura ${where}
      GROUP BY 1 ORDER BY 1`;
    return linhas.map((l) => ({ ...l, leituras: Number(l.leituras) }));
  }

  // Menor e maior data disponiveis (para os filtros do front).
  async periodo() {
    const { _min, _max } = await this.prisma.leitura.aggregate({
      _min: { dataLeitura: true },
      _max: { dataLeitura: true },
    });
    return { inicio: _min.dataLeitura, fim: _max.dataLeitura };
  }

  async totais(consulta: ConsultaLeiturasDto) {
    const where = this.montarFiltro(consulta);
    const [resultado, salas, porSentido] = await Promise.all([
      this.prisma.leitura.aggregate({ where, _count: true, _avg: { temperatura: true } }),
      this.prisma.leitura.findMany({ where, distinct: ['sala'], select: { sala: true } }),
      this.resumoPorSentido(consulta),
    ]);

    return {
      totalLeituras: resultado._count,
      temperaturaMedia: resultado._avg.temperatura
        ? Number(Number(resultado._avg.temperatura).toFixed(2))
        : null,
      salasMonitoradas: salas.length,
      porSentido,
    };
  }

  // Mesmo filtro de montarFiltro, em SQL (consulta parametrizada) para agregacoes.
  filtroSql(consulta: Pick<ConsultaLeiturasDto, 'inicio' | 'fim' | 'sentido' | 'estacaoId' | 'origem'>): Prisma.Sql {
    const condicoes: Prisma.Sql[] = [];
    if (consulta.inicio) condicoes.push(Prisma.sql`data_leitura >= ${new Date(consulta.inicio)}`);
    if (consulta.fim) {
      const limite = new Date(new Date(consulta.fim).getTime() + 86_400_000);
      condicoes.push(Prisma.sql`data_leitura < ${limite}`);
    }
    if (consulta.sentido) condicoes.push(Prisma.sql`sentido = ${consulta.sentido}::"Sentido"`);
    if (consulta.estacaoId !== undefined) condicoes.push(Prisma.sql`estacao_id = ${consulta.estacaoId}`);
    if (consulta.origem) condicoes.push(Prisma.sql`origem = ${consulta.origem}::"Origem"`);
    return condicoes.length ? Prisma.sql`WHERE ${Prisma.join(condicoes, ' AND ')}` : Prisma.empty;
  }

  // Media por hora e sentido, agregada no banco (consulta parametrizada).
  async serieHoraria(consulta: ConsultaLeiturasDto) {
    const where = this.filtroSql(consulta);

    return this.prisma.$queryRaw<{ hora: Date; sentido: string; temperaturaMedia: number }[]>`
      SELECT date_trunc('hour', data_leitura) AS hora,
             sentido::text AS sentido,
             ROUND(AVG(temperatura), 2)::float8 AS "temperaturaMedia"
      FROM leituras_temperatura
      ${where}
      GROUP BY 1, 2
      ORDER BY 1`;
  }

  async criar(dto: CriarLeituraDto) {
    const existente = await this.prisma.leitura.findUnique({ where: { id: dto.id } });
    if (existente) throw new ConflictException('Ja existe uma leitura com este id.');

    const leitura = await this.prisma.leitura.create({ data: dto });
    return { ...leitura, temperatura: Number(leitura.temperatura) };
  }
}
