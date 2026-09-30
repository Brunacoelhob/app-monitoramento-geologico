import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { createHash, randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { AtualizarEstacaoDto, CriarEstacaoDto, SensorDto } from './dto/estacoes.dto';
import { regras } from './config';
import { estaOnline } from './regras';

// A chave so existe em texto puro no momento em que e gerada; no banco fica o hash.
export const hashDaChave = (chave: string) => createHash('sha256').update(chave).digest('hex');
const gerarChave = () => `est_${randomBytes(24).toString('hex')}`;

@Injectable()
export class EstacoesService {
  constructor(private readonly prisma: PrismaService) {}

  // Ultima leitura de cada estacao (qualquer sensor): base do "online" e do alerta de silencio.
  async ultimaLeituraPorEstacao(): Promise<Map<number, Date>> {
    const linhas = await this.prisma.$queryRaw<{ estacao_id: number; ultima: Date }[]>`
      SELECT estacao_id, MAX(ultima) AS ultima FROM (
        SELECT s.estacao_id, MAX(l.instante) AS ultima
          FROM leituras_sismografo l JOIN sensores s ON s.id = l.sensor_id GROUP BY s.estacao_id
        UNION ALL
        SELECT s.estacao_id, MAX(l.instante)
          FROM leituras_gps l JOIN sensores s ON s.id = l.sensor_id GROUP BY s.estacao_id
        UNION ALL
        SELECT estacao_id, MAX(data_leitura) AT TIME ZONE 'UTC'
          FROM leituras_temperatura WHERE estacao_id IS NOT NULL GROUP BY estacao_id
      ) t GROUP BY estacao_id`;
    return new Map(linhas.map((l) => [l.estacao_id, l.ultima]));
  }

  async listar() {
    const [estacoes, ultimas] = await Promise.all([
      this.prisma.estacao.findMany({ include: { sensores: { orderBy: { id: 'asc' } } }, orderBy: { id: 'asc' } }),
      this.ultimaLeituraPorEstacao(),
    ]);
    const agora = new Date();
    const { semComunicacaoMinutos } = regras();

    return estacoes.map(({ chaveHash, ...estacao }) => {
      const ultimaLeitura = ultimas.get(estacao.id) ?? null;
      return {
        ...estacao,
        temChave: chaveHash !== null,
        ultimaLeitura,
        online: estacao.ativa && estaOnline(ultimaLeitura, agora, semComunicacaoMinutos),
      };
    });
  }

  async obter(id: number) {
    const estacao = (await this.listar()).find((e) => e.id === id);
    if (!estacao) throw new NotFoundException('Estação não encontrada.');
    return estacao;
  }

  private validarSensores(sensores: SensorDto[]) {
    for (const s of sensores) {
      if (s.tipo === 'TEMPERATURA' && !s.sentido) {
        throw new BadRequestException(`O sensor "${s.nome}" é de temperatura: informe se é INTERNO ou EXTERNO.`);
      }
      if (s.tipo !== 'TEMPERATURA' && s.sentido) {
        throw new BadRequestException(`O sensor "${s.nome}" não é de temperatura e não tem sentido.`);
      }
    }
  }

  // Devolve a estacao criada + a chave de API (mostrada uma unica vez).
  async criar(dto: CriarEstacaoDto) {
    this.validarSensores(dto.sensores);
    const chave = gerarChave();
    try {
      const estacao = await this.prisma.estacao.create({
        data: {
          codigo: dto.codigo,
          nome: dto.nome,
          latitude: dto.latitude,
          longitude: dto.longitude,
          placa: dto.placa,
          origem: dto.origem ?? 'REAL',
          chaveHash: hashDaChave(chave),
          sensores: { create: dto.sensores },
        },
      });
      return { ...(await this.obter(estacao.id)), chave };
    } catch (erro) {
      if (erro instanceof Prisma.PrismaClientKnownRequestError && erro.code === 'P2002') {
        throw new ConflictException('Já existe uma estação com este código.');
      }
      throw erro;
    }
  }

  async atualizar(id: number, dto: AtualizarEstacaoDto) {
    await this.obter(id);
    await this.prisma.estacao.update({ where: { id }, data: dto });
    return this.obter(id);
  }

  // RN-05: estacao inativa nao recebe leituras, mas o historico continua.
  async definirSituacao(id: number, ativa: boolean) {
    await this.obter(id);
    await this.prisma.estacao.update({ where: { id }, data: { ativa } });
    return this.obter(id);
  }

  // RN-09: o admin pode gerar outra chave quando quiser (a antiga deixa de valer).
  async gerarNovaChave(id: number) {
    await this.obter(id);
    const chave = gerarChave();
    await this.prisma.estacao.update({ where: { id }, data: { chaveHash: hashDaChave(chave) } });
    return { chave };
  }

  async adicionarSensor(id: number, dto: SensorDto) {
    await this.obter(id);
    this.validarSensores([dto]);
    await this.prisma.sensor.create({ data: { ...dto, estacaoId: id } });
    return this.obter(id);
  }

  // Series recentes de uma estacao para os graficos (sismografo, GPS e temperatura lado a lado).
  async series(id: number, horas: number) {
    const estacao = await this.obter(id);
    const desde = new Date(Date.now() - horas * 3_600_000);
    const [sismografo, gps, temperatura] = await Promise.all([
      this.prisma.$queryRaw<{ instante: Date; amplitude: number }[]>`
        SELECT l.instante, l.amplitude FROM leituras_sismografo l JOIN sensores s ON s.id = l.sensor_id
        WHERE s.estacao_id = ${id} AND l.instante >= ${desde} ORDER BY l.instante`,
      this.prisma.$queryRaw<
        { instante: Date; deslocamentoLesteMm: number | null; deslocamentoNorteMm: number | null }[]
      >`
        SELECT l.instante, l.deslocamento_leste_mm AS "deslocamentoLesteMm", l.deslocamento_norte_mm AS "deslocamentoNorteMm"
        FROM leituras_gps l JOIN sensores s ON s.id = l.sensor_id
        WHERE s.estacao_id = ${id} AND l.instante >= ${desde} ORDER BY l.instante`,
      this.prisma.$queryRaw<{ instante: Date; sentido: string; temperatura: number }[]>`
        SELECT data_leitura AT TIME ZONE 'UTC' AS instante, sentido::text AS sentido, temperatura::float8 AS temperatura
        FROM leituras_temperatura WHERE estacao_id = ${id} AND data_leitura >= ${desde} ORDER BY data_leitura`,
    ]);
    return { estacao: { id: estacao.id, nome: estacao.nome, origem: estacao.origem }, horas, sismografo, gps, temperatura };
  }
}
