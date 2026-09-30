import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AlertasService } from './alertas.service';
import { CAIXA_JAPAO, regras } from './config';
import { lerGeoJsonUsgs } from './usgs.parser';

const URL_USGS = 'https://earthquake.usgs.gov/fdsnws/event/1/query';

export interface ResultadoSincronizacao {
  recebidos: number;
  novos: number;
  atualizados: number;
  ignorado?: string;
}

// RN-07: importa os sismos do Japao (M4,0+) e do mundo todo (M4,5+). Reimportar nunca duplica
// (o idExterno e unico).
@Injectable()
export class UsgsService {
  private readonly log = new Logger(UsgsService.name);
  private emAndamento = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly alertas: AlertasService,
  ) {}

  async sincronizar(): Promise<ResultadoSincronizacao> {
    if (this.emAndamento) return { recebidos: 0, novos: 0, atualizados: 0, ignorado: 'Já há uma sincronização em andamento.' };
    this.emAndamento = true;
    try {
      return await this.executar();
    } finally {
      this.emAndamento = false;
    }
  }

  private async executar(): Promise<ResultadoSincronizacao> {
    const cfg = regras();
    const { _max } = await this.prisma.eventoSismico.aggregate({
      where: { origem: 'REAL' },
      _max: { atualizadoUsgsEm: true },
    });

    // Primeira vez: carga dos ultimos N dias. Depois: so o que mudou desde a ultima sincronizacao
    // (a margem de 1 hora cobre atrasos da fonte; o upsert absorve a repeticao).
    const comuns = new URLSearchParams({ format: 'geojson', orderby: 'time', includedeleted: 'true' });
    comuns.set('starttime', new Date(Date.now() - cfg.diasCargaInicial * 86_400_000).toISOString());
    // O mundo so conta como "carregado" quando o sismo mais antigo fora do Japao chega perto do
    // inicio da janela da carga inicial. Sem isso, a busca incremental (so o que mudou) nunca
    // traria o historico do resto do mundo.
    const maisAntigoFora = await this.prisma.eventoSismico.aggregate({
      _min: { ocorridoEm: true },
      where: { OR: [{ latitude: { lt: CAIXA_JAPAO.latMin } }, { latitude: { gt: CAIXA_JAPAO.latMax } }, { longitude: { lt: CAIXA_JAPAO.lonMin } }, { longitude: { gt: CAIXA_JAPAO.lonMax } }] },
    });
    const limiteHistorico = Date.now() - Math.max(cfg.diasCargaInicial - 2, 1) * 86_400_000;
    const temHistoricoMundial = !!maisAntigoFora._min.ocorridoEm && maisAntigoFora._min.ocorridoEm.getTime() <= limiteHistorico;
    if (_max.atualizadoUsgsEm && temHistoricoMundial) {
      comuns.set('updatedafter', new Date(_max.atualizadoUsgsEm.getTime() - 3_600_000).toISOString());
    }

    // Duas buscas: o Japao com mais sensibilidade (M4,0+) e o mundo todo (M4,5+).
    const japao = new URLSearchParams(comuns);
    japao.set('minlatitude', String(CAIXA_JAPAO.latMin));
    japao.set('maxlatitude', String(CAIXA_JAPAO.latMax));
    japao.set('minlongitude', String(CAIXA_JAPAO.lonMin));
    japao.set('maxlongitude', String(CAIXA_JAPAO.lonMax));
    japao.set('minmagnitude', String(cfg.magnitudeMinimaImportada));
    const mundo = new URLSearchParams(comuns);
    mundo.set('minmagnitude', String(cfg.magnitudeMinimaMundo));

    const unicos = new Map<string, ReturnType<typeof lerGeoJsonUsgs>[number]>();
    for (const params of [japao, mundo]) {
      const resposta = await fetch(`${URL_USGS}?${params}`, { signal: AbortSignal.timeout(30_000) });
      if (!resposta.ok) throw new Error(`USGS respondeu ${resposta.status}.`);
      for (const e of lerGeoJsonUsgs(await resposta.json())) unicos.set(e.idExterno, e);
    }

    // Em ordem cronologica: o evento maior precisa existir antes das suas replicas (RN-21).
    const eventos = [...unicos.values()].sort((a, b) => a.ocorridoEm.getTime() - b.ocorridoEm.getTime());

    let novos = 0;
    let atualizados = 0;
    for (const e of eventos) {
      const existente = await this.prisma.eventoSismico.findUnique({ where: { idExterno: e.idExterno } });
      // Evento que ja nasceu cancelado e que nunca tivemos: nao vale guardar.
      if (!existente && e.situacao === 'CANCELADO') continue;

      const dados = {
        magnitude: e.magnitude,
        profundidadeKm: e.profundidadeKm,
        latitude: e.latitude,
        longitude: e.longitude,
        local: e.local,
        ocorridoEm: e.ocorridoEm,
        situacao: e.situacao,
        atualizadoUsgsEm: e.atualizadoEm,
      };

      if (!existente) {
        const criado = await this.prisma.eventoSismico.create({ data: { idExterno: e.idExterno, origem: 'REAL', ...dados } });
        await this.alertas.processarEvento(criado);
        novos++;
      } else if (
        existente.magnitude !== e.magnitude ||
        existente.situacao !== e.situacao ||
        existente.atualizadoUsgsEm?.getTime() !== e.atualizadoEm.getTime()
      ) {
        const atualizado = await this.prisma.eventoSismico.update({ where: { id: existente.id }, data: dados });
        await this.alertas.processarEvento(atualizado);
        atualizados++;
      }
    }

    this.log.log(`USGS: ${eventos.length} recebidos, ${novos} novos, ${atualizados} atualizados.`);
    return { recebidos: eventos.length, novos, atualizados };
  }
}
