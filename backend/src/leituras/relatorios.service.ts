import { BadRequestException, Injectable } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import { Response } from 'express';
import PDFDocument = require('pdfkit');
import { PrismaService } from '../prisma/prisma.service';
import { ConsultaRelatorioDto } from './dto/consulta-relatorio.dto';
import { LeiturasService } from './leituras.service';

// Teto de linhas para CSV/Excel: protege o servidor de exportacoes gigantes.
export const MAX_LINHAS_RELATORIO = 500_000;
const TAMANHO_LOTE = 5_000;

interface LinhaPeriodo {
  periodo: Date;
  sentido: string;
  leituras: number;
  media: number;
  minima: number;
  maxima: number;
}

const ROTULO_SENTIDO: Record<string, string> = { INTERNO: 'Interno', EXTERNO: 'Externo' };
const dois = (n: number) => String(n).padStart(2, '0');

// As datas ficam gravadas sem fuso; por isso sempre lemos em UTC para
// mostrar exatamente o que esta no banco.
const formatarData = (d: Date) => `${dois(d.getUTCDate())}/${dois(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}`;
const formatarDataHora = (d: Date) => `${formatarData(d)} ${dois(d.getUTCHours())}:${dois(d.getUTCMinutes())}`;
const decimal = (n: number) => n.toFixed(1).replace('.', ',');
const decimal2 = (n: number) => n.toFixed(2).replace('.', ',');

@Injectable()
export class RelatoriosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly leituras: LeiturasService,
  ) {}

  async gerar(consulta: ConsultaRelatorioDto, res: Response): Promise<void> {
    const { formato, ...filtro } = consulta;
    const nome = `relatorio-temperaturas-${new Date().toISOString().slice(0, 10)}.${formato}`;

    if (formato !== 'pdf') {
      const total = await this.prisma.leitura.count({ where: this.leituras.montarFiltro(filtro as never) });
      if (total > MAX_LINHAS_RELATORIO) {
        throw new BadRequestException(
          `O período tem ${total} leituras e o máximo para ${formato.toUpperCase()} é ${MAX_LINHAS_RELATORIO}. Reduza o período.`,
        );
      }
    }

    const tipos = {
      pdf: 'application/pdf',
      xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      csv: 'text/csv; charset=utf-8',
    };
    res.set({
      'Content-Type': tipos[formato],
      'Content-Disposition': `attachment; filename="${nome}"`,
      'Cache-Control': 'no-store',
    });

    if (formato === 'csv') return this.gerarCsv(filtro, res);
    if (formato === 'xlsx') return this.gerarExcel(filtro, res);
    return this.gerarPdf(filtro, res);
  }

  // ---------- Dados ----------

  // Dia a dia quando o periodo e curto; mes a mes quando e longo (PDF legivel).
  private async porPeriodo(
    filtro: Omit<ConsultaRelatorioDto, 'formato'>,
    granularidade: 'day' | 'month',
  ): Promise<LinhaPeriodo[]> {
    const where = this.leituras.filtroSql(filtro);
    const linhas = await this.prisma.$queryRaw<
      { periodo: Date; sentido: string; leituras: bigint; media: number; minima: number; maxima: number }[]
    >`
      SELECT date_trunc(${granularidade}, data_leitura) AS periodo, sentido::text AS sentido,
             COUNT(*) AS leituras, AVG(temperatura)::float8 AS media,
             MIN(temperatura)::float8 AS minima, MAX(temperatura)::float8 AS maxima
      FROM leituras_temperatura ${where}
      GROUP BY 1, 2 ORDER BY 1, 2`;
    return linhas.map((l) => ({ ...l, leituras: Number(l.leituras) }));
  }

  // Le em lotes (paginacao por cursor) para nunca carregar tudo na memoria.
  private async *lerLeituras(filtro: Omit<ConsultaRelatorioDto, 'formato'>) {
    const where = this.leituras.montarFiltro(filtro as never);
    let cursor: string | undefined;
    for (;;) {
      const lote = await this.prisma.leitura.findMany({
        where,
        orderBy: [{ dataLeitura: 'asc' }, { id: 'asc' }],
        take: TAMANHO_LOTE,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      });
      if (lote.length === 0) return;
      yield lote;
      cursor = lote[lote.length - 1].id;
      if (lote.length < TAMANHO_LOTE) return;
    }
  }

  private descricaoFiltro(filtro: Omit<ConsultaRelatorioDto, 'formato'>): string[] {
    const periodo =
      filtro.inicio || filtro.fim
        ? `${filtro.inicio ? formatarData(new Date(filtro.inicio)) : 'inicio'} a ${filtro.fim ? formatarData(new Date(filtro.fim)) : 'hoje'}`
        : 'Todo o período';
    return [`Período: ${periodo}`, `Sentido: ${filtro.sentido ? ROTULO_SENTIDO[filtro.sentido] : 'Interno e Externo'}`];
  }

  private granularidade(filtro: Omit<ConsultaRelatorioDto, 'formato'>): 'day' | 'month' {
    if (!filtro.inicio || !filtro.fim) return 'month';
    const dias = (new Date(filtro.fim).getTime() - new Date(filtro.inicio).getTime()) / 86_400_000 + 1;
    return dias <= 120 ? 'day' : 'month';
  }

  // ---------- CSV ----------

  private async gerarCsv(filtro: Omit<ConsultaRelatorioDto, 'formato'>, res: Response): Promise<void> {
    // BOM + ponto e virgula + virgula decimal: abre certo no Excel em portugues.
    res.write('﻿id;sala;data_hora;sentido;temperatura\r\n');
    for await (const lote of this.lerLeituras(filtro)) {
      const texto = lote
        .map((l) => {
          const data = `${formatarData(l.dataLeitura)} ${dois(l.dataLeitura.getUTCHours())}:${dois(l.dataLeitura.getUTCMinutes())}:${dois(l.dataLeitura.getUTCSeconds())}`;
          return [this.protegerCsv(l.id), this.protegerCsv(l.sala), data, ROTULO_SENTIDO[l.sentido], decimal(Number(l.temperatura))].join(';');
        })
        .join('\r\n');
      res.write(texto + '\r\n');
    }
    res.end();
  }

  // Evita "injecao de formula" no Excel (celulas que comecam com = + - @) e
  // aspas/pontos e virgulas dentro do texto.
  private protegerCsv(valor: string): string {
    const seguro = /^[=+\-@\t\r]/.test(valor) ? `'${valor}` : valor;
    return /[";\r\n]/.test(seguro) ? `"${seguro.replace(/"/g, '""')}"` : seguro;
  }

  // ---------- Excel ----------

  private async gerarExcel(filtro: Omit<ConsultaRelatorioDto, 'formato'>, res: Response): Promise<void> {
    const livro = new ExcelJS.stream.xlsx.WorkbookWriter({ stream: res, useStyles: true });
    livro.creator = 'Monitoramento IoT';
    livro.created = new Date();
    const cabecalho = (aba: ExcelJS.Worksheet) => {
      const linha = aba.getRow(1);
      linha.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      linha.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF005CBB' } };
      linha.commit();
    };

    // Aba 1: resumo
    const resumo = livro.addWorksheet('Resumo');
    resumo.columns = [
      { header: 'Sentido', key: 'sentido', width: 16 },
      { header: 'Leituras', key: 'leituras', width: 14 },
      { header: 'Média (°C)', key: 'media', width: 14 },
      { header: 'Mínima (°C)', key: 'minima', width: 14 },
      { header: 'Máxima (°C)', key: 'maxima', width: 14 },
    ];
    cabecalho(resumo);
    for (const r of await this.leituras.resumoPorSentido(filtro)) {
      resumo.addRow({ ...r, sentido: ROTULO_SENTIDO[r.sentido], media: Number(r.media.toFixed(2)) }).commit();
    }
    resumo.addRow({}).commit();
    for (const texto of this.descricaoFiltro(filtro)) resumo.addRow({ sentido: texto }).commit();
    resumo.addRow({ sentido: `Gerado em: ${formatarDataHora(new Date())} (UTC)` }).commit();
    resumo.commit();

    // Aba 2: por dia ou mes
    const gran = this.granularidade(filtro);
    const agregada = livro.addWorksheet(gran === 'day' ? 'Por dia' : 'Por mês', {
      views: [{ state: 'frozen', ySplit: 1 }],
    });
    agregada.columns = [
      { header: gran === 'day' ? 'Dia' : 'Mês', key: 'periodo', width: 14, style: { numFmt: gran === 'day' ? 'dd/mm/yyyy' : 'mm/yyyy' } },
      { header: 'Sentido', key: 'sentido', width: 14 },
      { header: 'Leituras', key: 'leituras', width: 12 },
      { header: 'Média (°C)', key: 'media', width: 12 },
      { header: 'Mínima (°C)', key: 'minima', width: 12 },
      { header: 'Máxima (°C)', key: 'maxima', width: 12 },
    ];
    cabecalho(agregada);
    for (const l of await this.porPeriodo(filtro, gran)) {
      agregada.addRow({ ...l, sentido: ROTULO_SENTIDO[l.sentido], media: Number(l.media.toFixed(2)) }).commit();
    }
    agregada.commit();

    // Aba 3: todas as leituras
    const bruto = livro.addWorksheet('Leituras', { views: [{ state: 'frozen', ySplit: 1 }] });
    bruto.columns = [
      { header: 'ID', key: 'id', width: 34 },
      { header: 'Sala', key: 'sala', width: 16 },
      { header: 'Data e hora', key: 'dataLeitura', width: 18, style: { numFmt: 'dd/mm/yyyy hh:mm' } },
      { header: 'Sentido', key: 'sentido', width: 12 },
      { header: 'Temperatura (°C)', key: 'temperatura', width: 18, style: { numFmt: '0.0' } },
    ];
    cabecalho(bruto);
    for await (const lote of this.lerLeituras(filtro)) {
      for (const l of lote) {
        bruto
          .addRow({
            id: l.id,
            sala: l.sala,
            dataLeitura: l.dataLeitura,
            sentido: ROTULO_SENTIDO[l.sentido],
            temperatura: Number(l.temperatura),
          })
          .commit();
      }
    }
    bruto.commit();

    await livro.commit();
  }

  // ---------- PDF ----------

  private async gerarPdf(filtro: Omit<ConsultaRelatorioDto, 'formato'>, res: Response): Promise<void> {
    const [resumo, gran] = [await this.leituras.resumoPorSentido(filtro), this.granularidade(filtro)];
    const linhas = await this.porPeriodo(filtro, gran);
    const totais = await this.leituras.totais(filtro as never);

    const doc = new PDFDocument({ size: 'A4', margin: 40, info: { Title: 'Relatorio de temperaturas' } });
    doc.pipe(res);
    const AZUL = '#005cbb';
    const CINZA = '#5f6368';
    const CORES: Record<string, string> = { INTERNO: '#1e88e5', EXTERNO: '#f4511e' };
    const larguraUtil = doc.page.width - 80;

    // Cabecalho
    doc.rect(0, 0, doc.page.width, 92).fill(AZUL);
    doc.fillColor('#fff').font('Helvetica-Bold').fontSize(20).text('Relatório de Temperaturas', 40, 28);
    doc.font('Helvetica').fontSize(10).text(`Monitoramento de Sensores IoT  |  Gerado em ${formatarDataHora(new Date())} (UTC)`, 40, 56);
    doc.fillColor(CINZA).fontSize(10);
    let y = 108;
    for (const texto of this.descricaoFiltro(filtro)) {
      doc.text(texto, 40, y);
      y += 14;
    }

    // Indicadores
    y += 8;
    const cartoes = [
      ['Total de leituras', totais.totalLeituras.toLocaleString('pt-BR')],
      ['Temperatura média', totais.temperaturaMedia !== null ? `${decimal2(totais.temperaturaMedia)} °C` : '-'],
      ['Salas monitoradas', String(totais.salasMonitoradas)],
    ];
    const larguraCartao = (larguraUtil - 20) / 3;
    cartoes.forEach(([rotulo, valor], i) => {
      const x = 40 + i * (larguraCartao + 10);
      doc.roundedRect(x, y, larguraCartao, 54, 6).lineWidth(0.8).strokeColor('#dadce0').stroke();
      doc.fillColor(CINZA).font('Helvetica').fontSize(9).text(rotulo, x + 12, y + 10);
      doc.fillColor('#202124').font('Helvetica-Bold').fontSize(18).text(valor, x + 12, y + 26);
    });
    y += 74;

    // Resumo por sentido
    doc.fillColor(AZUL).font('Helvetica-Bold').fontSize(12).text('Resumo por sentido', 40, y);
    y += 20;
    const colunasResumo = [
      { titulo: 'Sentido', largura: 120, alinhar: 'left' as const },
      { titulo: 'Leituras', largura: 100, alinhar: 'right' as const },
      { titulo: 'Média (°C)', largura: 100, alinhar: 'right' as const },
      { titulo: 'Mínima (°C)', largura: 100, alinhar: 'right' as const },
      { titulo: 'Máxima (°C)', largura: 95, alinhar: 'right' as const },
    ];
    y = this.tabelaPdf(doc, y, colunasResumo, resumo.map((r) => [
      ROTULO_SENTIDO[r.sentido], r.leituras.toLocaleString('pt-BR'), decimal2(r.media), decimal(r.minima), decimal(r.maxima),
    ]));

    // Grafico de linhas (media por dia/mes)
    y += 18;
    if (y > doc.page.height - 260) {
      doc.addPage();
      y = 40;
    }
    doc.fillColor(AZUL).font('Helvetica-Bold').fontSize(12).text(`Temperatura média ${gran === 'day' ? 'por dia' : 'por mês'}`, 40, y);
    y = this.graficoPdf(doc, y + 18, larguraUtil, linhas, gran, CORES);

    // Tabela detalhada
    y += 24;
    if (y > doc.page.height - 120) {
      doc.addPage();
      y = 40;
    }
    doc.fillColor(AZUL).font('Helvetica-Bold').fontSize(12).text(`Detalhamento ${gran === 'day' ? 'diário' : 'mensal'}`, 40, y);
    y += 20;
    const colunasDetalhe = [
      { titulo: gran === 'day' ? 'Dia' : 'Mês', largura: 90, alinhar: 'left' as const },
      { titulo: 'Sentido', largura: 85, alinhar: 'left' as const },
      { titulo: 'Leituras', largura: 85, alinhar: 'right' as const },
      { titulo: 'Média (°C)', largura: 85, alinhar: 'right' as const },
      { titulo: 'Mínima (°C)', largura: 85, alinhar: 'right' as const },
      { titulo: 'Máxima (°C)', largura: 85, alinhar: 'right' as const },
    ];
    this.tabelaPdf(doc, y, colunasDetalhe, linhas.map((l) => [
      gran === 'day' ? formatarData(l.periodo) : `${dois(l.periodo.getUTCMonth() + 1)}/${l.periodo.getUTCFullYear()}`,
      ROTULO_SENTIDO[l.sentido], l.leituras.toLocaleString('pt-BR'), decimal2(l.media), decimal(l.minima), decimal(l.maxima),
    ]));

    // Rodape com numero de pagina
    const paginas = doc.bufferedPageRange();
    for (let i = paginas.start; i < paginas.start + paginas.count; i++) {
      doc.switchToPage(i);
      doc.page.margins.bottom = 0;
      doc.fillColor(CINZA).font('Helvetica').fontSize(8)
        .text(`Página ${i + 1} de ${paginas.count}`, 40, doc.page.height - 30, { width: larguraUtil, align: 'right', lineBreak: false });
    }
    doc.end();
    await new Promise<void>((resolver) => res.on('finish', () => resolver()));
  }

  // Tabela simples com cabecalho repetido a cada pagina.
  private tabelaPdf(
    doc: PDFKit.PDFDocument,
    yInicial: number,
    colunas: { titulo: string; largura: number; alinhar: 'left' | 'right' }[],
    linhas: string[][],
  ): number {
    let y = yInicial;
    const altura = 18;
    const desenharCabecalho = () => {
      let x = 40;
      doc.rect(40, y, colunas.reduce((s, c) => s + c.largura, 0), altura).fill('#e8f0fe');
      doc.fillColor('#202124').font('Helvetica-Bold').fontSize(9);
      for (const c of colunas) {
        doc.text(c.titulo, x + 6, y + 5, { width: c.largura - 12, align: c.alinhar, lineBreak: false });
        x += c.largura;
      }
      y += altura;
    };
    desenharCabecalho();

    linhas.forEach((linha, indice) => {
      if (y > doc.page.height - 60) {
        doc.addPage();
        y = 40;
        desenharCabecalho();
      }
      if (indice % 2 === 1) doc.rect(40, y, colunas.reduce((s, c) => s + c.largura, 0), altura).fill('#f8f9fa');
      doc.fillColor('#202124').font('Helvetica').fontSize(9);
      let x = 40;
      linha.forEach((celula, i) => {
        doc.text(celula, x + 6, y + 5, { width: colunas[i].largura - 12, align: colunas[i].alinhar, lineBreak: false });
        x += colunas[i].largura;
      });
      y += altura;
    });
    return y;
  }

  // Grafico de linhas vetorial (sem imagem): uma linha por sentido.
  private graficoPdf(
    doc: PDFKit.PDFDocument,
    y: number,
    largura: number,
    linhas: LinhaPeriodo[],
    gran: 'day' | 'month',
    cores: Record<string, string>,
  ): number {
    const altura = 170;
    const esquerda = 44;
    const x0 = 40 + esquerda;
    const larguraGrafico = largura - esquerda - 8;
    const periodos = [...new Set(linhas.map((l) => l.periodo.getTime()))].sort((a, b) => a - b);
    if (periodos.length === 0) return y;

    const valores = linhas.map((l) => l.media);
    let min = Math.floor(Math.min(...valores) - 1);
    let max = Math.ceil(Math.max(...valores) + 1);
    if (min === max) max = min + 1;

    // Grade horizontal e eixo Y
    doc.lineWidth(0.5).strokeColor('#dadce0').fillColor('#5f6368').font('Helvetica').fontSize(8);
    for (let i = 0; i <= 4; i++) {
      const yLinha = y + altura - (altura * i) / 4;
      doc.moveTo(x0, yLinha).lineTo(x0 + larguraGrafico, yLinha).stroke();
      doc.text(`${(min + ((max - min) * i) / 4).toFixed(0)}°`, 40, yLinha - 4, { width: esquerda - 6, align: 'right', lineBreak: false });
    }

    const posX = (t: number) =>
      x0 + (periodos.length === 1 ? larguraGrafico / 2 : (periodos.indexOf(t) / (periodos.length - 1)) * larguraGrafico);
    const posY = (v: number) => y + altura - ((v - min) / (max - min)) * altura;

    for (const sentido of ['INTERNO', 'EXTERNO']) {
      const pontos = linhas.filter((l) => l.sentido === sentido);
      if (pontos.length === 0) continue;
      doc.lineWidth(1.4).strokeColor(cores[sentido]);
      pontos.forEach((p, i) => {
        const px = posX(p.periodo.getTime());
        const py = posY(p.media);
        if (i === 0) doc.moveTo(px, py);
        else doc.lineTo(px, py);
      });
      doc.stroke();
    }

    // Rotulos do eixo X (primeiro, meio e ultimo) e legenda
    const rotulo = (t: number) => (gran === 'day' ? formatarData(new Date(t)) : `${dois(new Date(t).getUTCMonth() + 1)}/${new Date(t).getUTCFullYear()}`);
    doc.fillColor('#5f6368').fontSize(8);
    const indicesRotulo = [...new Set([0, Math.floor((periodos.length - 1) / 2), periodos.length - 1])];
    for (const i of indicesRotulo) {
      doc.text(rotulo(periodos[i]), posX(periodos[i]) - 30, y + altura + 6, { width: 60, align: 'center', lineBreak: false });
    }
    let xLegenda = x0;
    for (const sentido of ['INTERNO', 'EXTERNO']) {
      if (!linhas.some((l) => l.sentido === sentido)) continue;
      doc.rect(xLegenda, y + altura + 24, 10, 4).fill(cores[sentido]);
      doc.fillColor('#202124').text(ROTULO_SENTIDO[sentido], xLegenda + 14, y + altura + 21, { lineBreak: false });
      xLegenda += 80;
    }
    return y + altura + 34;
  }
}
