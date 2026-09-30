import { BadRequestException, Injectable } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import { Response } from 'express';
import PDFDocument = require('pdfkit');
import { PrismaService } from '../prisma/prisma.service';
import { ConsultaRelatorioEventosDto } from './dto/eventos.dto';
import { EventosService } from './eventos.service';
import { nivelPorMagnitude } from './regras';
import { Prisma } from '@prisma/client';

// RN-25: relatorio de eventos e alertas em PDF, Excel e CSV, respeitando os filtros.
// A origem (REAL/SIMULADO) aparece em todas as linhas (RN-06).
export const MAX_LINHAS_SISMOS = 500_000;
const LOTE = 5_000;
const dois = (n: number) => String(n).padStart(2, '0');

// RN-28: as datas ficam em UTC; o relatorio traz UTC e JST (UTC+9).
const formatar = (d: Date, deslocamentoHoras = 0) => {
  const x = new Date(d.getTime() + deslocamentoHoras * 3_600_000);
  return `${dois(x.getUTCDate())}/${dois(x.getUTCMonth() + 1)}/${x.getUTCFullYear()} ${dois(x.getUTCHours())}:${dois(x.getUTCMinutes())}`;
};
const decimal = (n: number, casas = 1) => n.toFixed(casas).replace('.', ',');
const rotuloNivel = (m: number) => nivelPorMagnitude(m) ?? 'REGISTRO';

interface LinhaEvento {
  idExterno: string;
  ocorridoEm: Date;
  magnitude: number;
  profundidadeKm: number;
  latitude: number;
  longitude: number;
  local: string;
  origem: string;
  situacao: string;
}

@Injectable()
export class RelatorioSismosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventos: EventosService,
  ) {}

  async gerar(consulta: ConsultaRelatorioEventosDto, res: Response): Promise<void> {
    const { formato, ...filtros } = consulta;
    const where = await this.eventos.filtroSql(filtros);

    const [{ total }] = await this.prisma.$queryRaw<{ total: bigint }[]>`SELECT COUNT(*) AS total FROM eventos_sismicos e ${where}`;
    if (formato !== 'pdf' && Number(total) > MAX_LINHAS_SISMOS) {
      throw new BadRequestException(
        `O período tem ${total} eventos e o máximo para ${formato.toUpperCase()} é ${MAX_LINHAS_SISMOS}. Reduza o período.`,
      );
    }

    const nome = `relatorio-sismos-${new Date().toISOString().slice(0, 10)}.${formato}`;
    const tipos = {
      pdf: 'application/pdf',
      xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      csv: 'text/csv; charset=utf-8',
    };
    res.set({ 'Content-Type': tipos[formato], 'Content-Disposition': `attachment; filename="${nome}"`, 'Cache-Control': 'no-store' });

    if (formato === 'csv') return this.csv(where, res);
    if (formato === 'xlsx') return this.excel(where, filtros, res);
    return this.pdf(where, filtros, Number(total), res);
  }

  private async *lerEventos(where: Prisma.Sql): AsyncGenerator<LinhaEvento[]> {
    for (let deslocamento = 0; ; deslocamento += LOTE) {
      const lote = await this.prisma.$queryRaw<LinhaEvento[]>`
        SELECT e.id_externo AS "idExterno", e.ocorrido_em AS "ocorridoEm", e.magnitude,
               e.profundidade_km AS "profundidadeKm", e.latitude, e.longitude, e.local,
               e.origem::text AS origem, e.situacao::text AS situacao
        FROM eventos_sismicos e ${where}
        ORDER BY e.ocorrido_em DESC, e.id LIMIT ${LOTE} OFFSET ${deslocamento}`;
      if (lote.length === 0) return;
      yield lote;
      if (lote.length < LOTE) return;
    }
  }

  private protegerCsv(valor: string): string {
    const seguro = /^[=+\-@\t\r]/.test(valor) ? `'${valor}` : valor;
    return /[";\r\n]/.test(seguro) ? `"${seguro.replace(/"/g, '""')}"` : seguro;
  }

  private async csv(where: Prisma.Sql, res: Response) {
    res.write('﻿id_usgs;data_utc;data_jst;magnitude;nivel;profundidade_km;latitude;longitude;local;origem;situacao\r\n');
    for await (const lote of this.lerEventos(where)) {
      res.write(
        lote
          .map((e) =>
            [
              this.protegerCsv(e.idExterno), formatar(e.ocorridoEm), formatar(e.ocorridoEm, 9), decimal(e.magnitude),
              rotuloNivel(e.magnitude), decimal(e.profundidadeKm), decimal(e.latitude, 3), decimal(e.longitude, 3),
              this.protegerCsv(e.local), e.origem, e.situacao,
            ].join(';'),
          )
          .join('\r\n') + '\r\n',
      );
    }
    res.end();
  }

  private async excel(where: Prisma.Sql, filtros: Omit<ConsultaRelatorioEventosDto, 'formato'>, res: Response) {
    const livro = new ExcelJS.stream.xlsx.WorkbookWriter({ stream: res, useStyles: true });
    const cabecalho = (aba: ExcelJS.Worksheet) => {
      const linha = aba.getRow(1);
      linha.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      linha.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1B6A8A' } };
      linha.commit();
    };

    const resumo = livro.addWorksheet('Resumo');
    resumo.columns = [{ header: 'Nível', key: 'nivel', width: 18 }, { header: 'Eventos', key: 'eventos', width: 14 }];
    cabecalho(resumo);
    const porNivel = await this.prisma.$queryRaw<{ maior: number | null; total: bigint; atencao: bigint; alto: bigint; critico: bigint; registro: bigint }[]>`
      SELECT MAX(e.magnitude) AS maior, COUNT(*) AS total,
        COUNT(*) FILTER (WHERE e.magnitude >= 4.5 AND e.magnitude < 5.5) AS atencao,
        COUNT(*) FILTER (WHERE e.magnitude >= 5.5 AND e.magnitude < 6.5) AS alto,
        COUNT(*) FILTER (WHERE e.magnitude >= 6.5) AS critico,
        COUNT(*) FILTER (WHERE e.magnitude < 4.5) AS registro
      FROM eventos_sismicos e ${where}`;
    const r = porNivel[0];
    for (const [nivel, eventos] of [['CRITICO', r.critico], ['ALTO', r.alto], ['ATENCAO', r.atencao], ['REGISTRO', r.registro]] as const) {
      resumo.addRow({ nivel, eventos: Number(eventos) }).commit();
    }
    resumo.addRow({}).commit();
    resumo.addRow({ nivel: 'Total', eventos: Number(r.total) }).commit();
    resumo.addRow({ nivel: 'Maior magnitude', eventos: r.maior ?? '-' }).commit();
    resumo.addRow({ nivel: `Período: ${filtros.inicio ?? 'início'} a ${filtros.fim ?? 'hoje'}` }).commit();
    resumo.addRow({ nivel: 'Horários em UTC e JST (UTC+9).' }).commit();
    resumo.commit();

    const eventos = livro.addWorksheet('Eventos', { views: [{ state: 'frozen', ySplit: 1 }] });
    eventos.columns = [
      { header: 'ID (USGS)', key: 'id', width: 16 },
      { header: 'Data (UTC)', key: 'utc', width: 18, style: { numFmt: 'dd/mm/yyyy hh:mm' } },
      { header: 'Data (JST)', key: 'jst', width: 18, style: { numFmt: 'dd/mm/yyyy hh:mm' } },
      { header: 'Magnitude', key: 'mag', width: 11, style: { numFmt: '0.0' } },
      { header: 'Nível', key: 'nivel', width: 11 },
      { header: 'Profundidade (km)', key: 'prof', width: 17, style: { numFmt: '0.0' } },
      { header: 'Latitude', key: 'lat', width: 10 },
      { header: 'Longitude', key: 'lon', width: 10 },
      { header: 'Local', key: 'local', width: 42 },
      { header: 'Origem', key: 'origem', width: 11 },
      { header: 'Situação', key: 'situacao', width: 12 },
    ];
    cabecalho(eventos);
    for await (const lote of this.lerEventos(where)) {
      for (const e of lote) {
        eventos
          .addRow({
            id: e.idExterno, utc: e.ocorridoEm, jst: new Date(e.ocorridoEm.getTime() + 9 * 3_600_000), mag: e.magnitude,
            nivel: rotuloNivel(e.magnitude), prof: e.profundidadeKm, lat: e.latitude, lon: e.longitude,
            local: e.local, origem: e.origem, situacao: e.situacao,
          })
          .commit();
      }
    }
    eventos.commit();

    // Alertas abertos no mesmo periodo
    const alertas = livro.addWorksheet('Alertas', { views: [{ state: 'frozen', ySplit: 1 }] });
    alertas.columns = [
      { header: 'Aberto em (UTC)', key: 'aberto', width: 18, style: { numFmt: 'dd/mm/yyyy hh:mm' } },
      { header: 'Nível', key: 'nivel', width: 11 },
      { header: 'Estado', key: 'estado', width: 14 },
      { header: 'Tipo', key: 'tipo', width: 17 },
      { header: 'Título', key: 'titulo', width: 50 },
      { header: 'Encerrado em (UTC)', key: 'encerrado', width: 18, style: { numFmt: 'dd/mm/yyyy hh:mm' } },
      { header: 'Motivo do encerramento', key: 'motivo', width: 40 },
    ];
    cabecalho(alertas);
    const lista = await this.prisma.alerta.findMany({
      where: {
        abertoEm: {
          ...(filtros.inicio ? { gte: new Date(filtros.inicio) } : {}),
          ...(filtros.fim ? { lt: new Date(new Date(filtros.fim).getTime() + 86_400_000) } : {}),
        },
      },
      orderBy: { abertoEm: 'desc' },
      take: MAX_LINHAS_SISMOS,
    });
    for (const a of lista) {
      alertas
        .addRow({ aberto: a.abertoEm, nivel: a.nivel, estado: a.estado, tipo: a.tipo, titulo: a.titulo, encerrado: a.encerradoEm, motivo: a.motivoEncerramento })
        .commit();
    }
    alertas.commit();
    await livro.commit();
  }

  private async pdf(where: Prisma.Sql, filtros: Omit<ConsultaRelatorioEventosDto, 'formato'>, total: number, res: Response) {
    const [resumo, maiores] = await Promise.all([
      this.prisma.$queryRaw<{ maior: number | null; atencao: bigint; alto: bigint; critico: bigint; registro: bigint }[]>`
        SELECT MAX(e.magnitude) AS maior,
          COUNT(*) FILTER (WHERE e.magnitude >= 4.5 AND e.magnitude < 5.5) AS atencao,
          COUNT(*) FILTER (WHERE e.magnitude >= 5.5 AND e.magnitude < 6.5) AS alto,
          COUNT(*) FILTER (WHERE e.magnitude >= 6.5) AS critico,
          COUNT(*) FILTER (WHERE e.magnitude < 4.5) AS registro
        FROM eventos_sismicos e ${where}`,
      this.prisma.$queryRaw<LinhaEvento[]>`
        SELECT e.id_externo AS "idExterno", e.ocorrido_em AS "ocorridoEm", e.magnitude,
               e.profundidade_km AS "profundidadeKm", e.latitude, e.longitude, e.local,
               e.origem::text AS origem, e.situacao::text AS situacao
        FROM eventos_sismicos e ${where} ORDER BY e.magnitude DESC, e.ocorrido_em DESC LIMIT 40`,
    ]);
    const r = resumo[0];

    const doc = new PDFDocument({ size: 'A4', margin: 40, info: { Title: 'Relatório de sismos' } });
    doc.pipe(res);
    const largura = doc.page.width - 80;
    const AZUL = '#1b6a8a';

    doc.rect(0, 0, doc.page.width, 84).fill('#0f1b24');
    doc.fillColor('#fff').font('Helvetica-Bold').fontSize(20).text('Relatório de sismos', 40, 26);
    doc.font('Helvetica').fontSize(10).text(`Japão, dados do USGS  |  Gerado em ${formatar(new Date(), 9)} (JST)`, 40, 54);

    doc.fillColor('#5f6368').fontSize(10);
    doc.text(`Período: ${filtros.inicio ?? 'início'} a ${filtros.fim ?? 'hoje'}`, 40, 98);
    doc.text('Horários em JST (UTC+9). Dados simulados, quando houver, aparecem marcados como SIMULADO.', 40, 112, { width: largura });

    let y = 140;
    const cartoes = [['Eventos', total.toLocaleString('pt-BR')], ['Maior magnitude', r.maior ? decimal(r.maior) : '-'], ['Nível crítico', String(Number(r.critico))]];
    const larguraCartao = (largura - 20) / 3;
    cartoes.forEach(([rotulo, valor], i) => {
      const x = 40 + i * (larguraCartao + 10);
      doc.roundedRect(x, y, larguraCartao, 50, 6).lineWidth(0.8).strokeColor('#dadce0').stroke();
      doc.fillColor('#5f6368').font('Helvetica').fontSize(9).text(rotulo, x + 12, y + 9);
      doc.fillColor('#202124').font('Helvetica-Bold').fontSize(18).text(valor, x + 12, y + 24);
    });
    y += 70;

    const tabela = (titulo: string, colunas: { t: string; l: number; a: 'left' | 'right' }[], linhas: string[][]) => {
      doc.fillColor(AZUL).font('Helvetica-Bold').fontSize(12).text(titulo, 40, y);
      y += 20;
      const cabecalho = () => {
        doc.rect(40, y, colunas.reduce((s, c) => s + c.l, 0), 18).fill('#e8f0fe');
        let x = 40;
        doc.fillColor('#202124').font('Helvetica-Bold').fontSize(9);
        for (const c of colunas) { doc.text(c.t, x + 6, y + 5, { width: c.l - 12, align: c.a, lineBreak: false }); x += c.l; }
        y += 18;
      };
      cabecalho();
      linhas.forEach((linha, i) => {
        if (y > doc.page.height - 60) { doc.addPage(); y = 40; cabecalho(); }
        if (i % 2) doc.rect(40, y, colunas.reduce((s, c) => s + c.l, 0), 18).fill('#f8f9fa');
        doc.fillColor('#202124').font('Helvetica').fontSize(9);
        let x = 40;
        linha.forEach((celula, k) => { doc.text(celula, x + 6, y + 5, { width: colunas[k].l - 12, align: colunas[k].a, lineBreak: false }); x += colunas[k].l; });
        y += 18;
      });
      y += 18;
    };

    tabela('Eventos por nível', [{ t: 'Nível', l: 200, a: 'left' }, { t: 'Faixa de magnitude', l: 160, a: 'left' }, { t: 'Eventos', l: 155, a: 'right' }], [
      ['Crítico', '6,5 ou mais', String(Number(r.critico))],
      ['Alto', '5,5 a 6,4', String(Number(r.alto))],
      ['Atenção', '4,5 a 5,4', String(Number(r.atencao))],
      ['Registro', 'menos de 4,5', String(Number(r.registro))],
    ]);
    tabela(`Maiores eventos do período (até 40)`, [
      { t: 'Data (JST)', l: 85, a: 'left' }, { t: 'Mag.', l: 40, a: 'right' }, { t: 'Nível', l: 60, a: 'left' },
      { t: 'Prof. (km)', l: 60, a: 'right' }, { t: 'Local', l: 210, a: 'left' }, { t: 'Origem', l: 60, a: 'left' },
    ], maiores.map((e) => [
      formatar(e.ocorridoEm, 9), decimal(e.magnitude), rotuloNivel(e.magnitude), decimal(e.profundidadeKm),
      e.local.slice(0, 40), e.origem,
    ]));

    const paginas = doc.bufferedPageRange();
    for (let i = paginas.start; i < paginas.start + paginas.count; i++) {
      doc.switchToPage(i);
      doc.page.margins.bottom = 0;
      doc.fillColor('#5f6368').font('Helvetica').fontSize(8)
        .text('Projeto de portfólio. Não é um sistema oficial de alerta sísmico. Para alertas oficiais, consulte a JMA.', 40, doc.page.height - 34, { width: largura - 80, lineBreak: false })
        .text(`Página ${i + 1} de ${paginas.count}`, 40, doc.page.height - 34, { width: largura, align: 'right', lineBreak: false });
    }
    doc.end();
    await new Promise<void>((resolver) => res.on('finish', () => resolver()));
  }
}
