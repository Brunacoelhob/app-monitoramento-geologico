import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { TempoRealService } from '../tempo-real/tempo-real.service';
import { CsvInvalidoError, ErroLinha, lerCsvLeituras } from './importacao';

const TAMANHO_LOTE = 5000;
const MAX_ERROS_NA_RESPOSTA = 50;
const CODIGO_LEGADO = 'LEGADO-SALA-ADMIN';

export interface ResultadoImportacao {
  linhasLidas: number;
  importadas: number;
  ignoradas: number;
  totalRejeitadas: number;
  rejeitadas: ErroLinha[];
}

// Importa leituras de temperatura de um CSV. Diferente do script de linha de comando (que aborta tudo se uma
// linha for ruim), aqui as linhas boas entram e as ruins voltam com o numero da linha e o motivo.
@Injectable()
export class ImportacaoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tempoReal: TempoRealService,
  ) {}

  async importar(arquivo: Buffer, estacaoId?: number): Promise<ResultadoImportacao> {
    // Um arquivo binario (imagem, planilha .xlsx etc.) tem bytes nulos: texto de verdade nao tem
    if (arquivo.includes(0)) {
      throw new BadRequestException('O arquivo não é um CSV de texto. Salve a planilha como "CSV (separado por vírgulas ou ponto e vírgula)".');
    }

    const estacao = estacaoId
      ? await this.prisma.estacao.findUnique({ where: { id: estacaoId } })
      : await this.prisma.estacao.findUnique({ where: { codigo: CODIGO_LEGADO } });
    if (!estacao) {
      throw new NotFoundException(estacaoId ? 'Estação não encontrada.' : 'Estação padrão não encontrada. Informe a estação ou rode as migrations.');
    }

    let leitura;
    try {
      leitura = lerCsvLeituras(arquivo.toString('utf-8'));
    } catch (erro) {
      if (erro instanceof CsvInvalidoError) throw new BadRequestException(erro.message);
      throw erro;
    }

    let importadas = 0;
    for (let i = 0; i < leitura.validas.length; i += TAMANHO_LOTE) {
      const lote = leitura.validas.slice(i, i + TAMANHO_LOTE).map((l) => ({
        id: l.id ?? `imp-${randomUUID()}`,
        sala: l.sala,
        dataLeitura: l.dataLeitura,
        temperatura: l.temperatura,
        sentido: l.sentido,
        estacaoId: estacao.id,
        origem: estacao.origem,
      }));
      importadas += (await this.prisma.leitura.createMany({ data: lote, skipDuplicates: true })).count;
    }

    if (importadas > 0) this.tempoReal.emitir('leituras', { estacaoId: estacao.id, importadas });

    return {
      linhasLidas: leitura.totalLinhas,
      importadas,
      // ids repetidos no arquivo + ids que ja existiam no banco
      ignoradas: leitura.repetidasNoArquivo + (leitura.validas.length - importadas),
      totalRejeitadas: leitura.erros.length,
      rejeitadas: leitura.erros.slice(0, MAX_ERROS_NA_RESPOSTA),
    };
  }
}
