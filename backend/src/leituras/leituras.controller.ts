import { BadRequestException, Body, Controller, Get, HttpCode, Post, Query, Res, StreamableFile, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { Papel } from '@prisma/client';
import { ApiBody, ApiConsumes, ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiPayloadTooLargeResponse, ApiProduces, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Response } from 'express';
import { Papeis } from '../auth/decoradores';
import {
  ErroApi,
  ImportacaoResposta,
  LeituraResposta,
  PaginaLeiturasResposta,
  PeriodoResposta,
  PontoSerieHorariaResposta,
  TotaisLeiturasResposta,
} from '../comum/respostas.dto';
import { Autenticada, Conflito, Invalida, NaoEncontrada, SomenteAdmin, TAGS } from '../comum/swagger';
import { ConsultaLeiturasDto } from './dto/consulta-leituras.dto';
import { ConsultaRelatorioDto } from './dto/consulta-relatorio.dto';
import { CriarLeituraDto } from './dto/criar-leitura.dto';
import { ImportarLeiturasDto } from './dto/importar-leituras.dto';
import { ImportacaoService } from './importacao.service';
import { MODELO_CSV } from './importacao';
import { LeiturasService } from './leituras.service';
import { RelatoriosService } from './relatorios.service';

// Qualquer usuario logado le; so ADMIN cria (regra aplicada aqui no backend).
const MB = 1024 * 1024;

// O arquivo fica em memoria so ate ser lido (limite de 5 MB, cerca de 100 mil linhas)
const uploadCsv = FileInterceptor('arquivo', {
  storage: memoryStorage(),
  limits: { fileSize: 5 * MB, files: 1 },
  fileFilter: (_req, arquivo, aceitar) => {
    const nome = arquivo.originalname.toLowerCase();
    aceitar(nome.endsWith('.csv') || nome.endsWith('.txt') ? null : new BadRequestException('Envie um arquivo .csv.'), nome.endsWith('.csv') || nome.endsWith('.txt'));
  },
});

@ApiTags(TAGS.leituras)
@Autenticada()
@Controller('leituras')
export class LeiturasController {
  constructor(
    private readonly leiturasService: LeiturasService,
    private readonly relatoriosService: RelatoriosService,
    private readonly importacao: ImportacaoService,
  ) {}

  @ApiOperation({
    summary: 'Listar leituras (paginado)',
    description:
      'Leituras de temperatura, da mais recente para a mais antiga, com os filtros opcionais. ' +
      'Sem `inicio`/`fim` considera todo o histórico. Use `pagina` e `limite` (máx. 100) para percorrer os resultados.',
  })
  @ApiOkResponse({ description: 'Página de leituras.', type: PaginaLeiturasResposta })
  @Invalida()
  @Get()
  listar(@Query() consulta: ConsultaLeiturasDto) {
    return this.leiturasService.listar(consulta);
  }

  @ApiOperation({
    summary: 'Período com dados',
    description: 'Primeira e última data com leituras. Serve para limitar o calendário dos filtros. Devolve `null` nos dois campos se não há dados.',
  })
  @ApiOkResponse({ description: 'Intervalo de datas disponível.', type: PeriodoResposta })
  @Get('periodo')
  periodo() {
    return this.leiturasService.periodo();
  }

  @ApiOperation({
    summary: 'Totais e médias',
    description: 'Total de leituras, temperatura média, salas monitoradas e o resumo (média, mínima, máxima) por sentido, no período filtrado.',
  })
  @ApiOkResponse({ description: 'Indicadores do período.', type: TotaisLeiturasResposta })
  @Invalida()
  @Get('totais')
  totais(@Query() consulta: ConsultaLeiturasDto) {
    return this.leiturasService.totais(consulta);
  }

  @ApiOperation({
    summary: 'Série por hora',
    description: 'Temperatura média de cada hora, separada por sentido. Alimenta o gráfico de linha da tela Temperatura.',
  })
  @ApiOkResponse({ description: 'Pontos da série (hora × sentido).', type: [PontoSerieHorariaResposta] })
  @Invalida()
  @Get('serie-horaria')
  serieHoraria(@Query() consulta: ConsultaLeiturasDto) {
    return this.leiturasService.serieHoraria(consulta);
  }

  // Baixa o relatorio nos formatos pdf, xlsx ou csv (streaming direto na resposta).
  // Limite proprio: gerar relatorio e pesado e nao deve ser chamado em serie.
  @ApiOperation({
    summary: 'Baixar relatório de temperatura',
    description:
      'Gera o arquivo nos formatos **pdf**, **xlsx** (Excel) ou **csv** com os mesmos filtros da consulta. ' +
      'No Swagger, use **Execute** e depois o link **Download file**.\n\n' +
      'Em xlsx e csv há um teto de linhas; se o período for grande, a API devolve 400 pedindo para reduzir. O PDF não tem esse teto. ' +
      'Limite de **10 relatórios por minuto**.',
  })
  @ApiProduces('application/pdf', 'text/csv', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  @ApiResponse({
    status: 200,
    description: 'Arquivo do relatório (cabeçalho `Content-Disposition: attachment`).',
    content: {
      'application/pdf': { schema: { type: 'string', format: 'binary' } },
      'text/csv': { schema: { type: 'string', format: 'binary' } },
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': { schema: { type: 'string', format: 'binary' } },
    },
  })
  @Invalida('Formato inválido, filtro inválido ou período grande demais para xlsx/csv.')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Get('relatorio')
  relatorio(@Query() consulta: ConsultaRelatorioDto, @Res() res: Response) {
    return this.relatoriosService.gerar(consulta, res);
  }

  @ApiOperation({
    summary: 'Baixar o modelo de CSV para importação',
    description: 'Arquivo de exemplo com o cabeçalho e três linhas. Abre no Excel (separador `;`, datas `dd/mm/aaaa hh:mm`, decimal com vírgula).',
  })
  @ApiProduces('text/csv')
  @ApiResponse({ status: 200, description: 'Arquivo `modelo-importacao-leituras.csv`.', content: { 'text/csv': { schema: { type: 'string', format: 'binary' } } } })
  @Get('importar/modelo')
  modeloImportacao(@Res({ passthrough: true }) res: Response) {
    res.set({ 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="modelo-importacao-leituras.csv"' });
    // BOM para o Excel reconhecer os acentos
    return new StreamableFile(Buffer.from('\ufeff' + MODELO_CSV, 'utf-8'));
  }

  @ApiOperation({
    summary: 'Importar leituras de um arquivo CSV (upload)',
    description:
      '**Somente ADMIN.** Envie um `.csv` no campo `arquivo` (no Swagger, o botão **Choose File**). Opcionalmente informe `estacaoId`; sem ele, as leituras vão para a estação padrão.\n\n' +
      '**Colunas:** `sala`, `data_leitura`, `temperatura`, `sentido` e, opcionalmente, `id`. Também aceita as colunas do dataset original (`room_id/id`, `noted_date`, `temp`, `out/in`).\n\n' +
      '**Formatos:** separador `;` ou `,`; data `dd/mm/aaaa hh:mm`, `dd-mm-aaaa hh:mm` ou ISO (`2026-09-29 14:30`; sem fuso vale UTC); temperatura com ponto ou vírgula ' +
      '(de -50 a 150 °C); sentido `INTERNO`/`EXTERNO` ou `In`/`Out`. Máximo de **5 MB** e **20 mil linhas** por arquivo.\n\n' +
      '**Como funciona:** cada linha é validada separadamente. As boas são gravadas; as ruins voltam em `rejeitadas` com o número da linha e o motivo. ' +
      'Linhas com `id` repetido (no arquivo ou já existente) são ignoradas, então reenviar o mesmo arquivo é seguro. Ao terminar, os painéis abertos se atualizam sozinhos. Limite de 10 importações por minuto.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        arquivo: { type: 'string', format: 'binary', description: 'Arquivo .csv (até 5 MB).' },
        estacaoId: { type: 'integer', example: 4, description: 'Estação que recebe as leituras (opcional).' },
      },
      required: ['arquivo'],
    },
  })
  @ApiOkResponse({ description: 'Importação concluída (mesmo que algumas linhas tenham sido recusadas).', type: ImportacaoResposta })
  @Invalida('Nenhum arquivo, arquivo que não é CSV de texto, cabeçalho sem as colunas obrigatórias, arquivo vazio ou com mais de 20 mil linhas.')
  @ApiPayloadTooLargeResponse({ description: 'O arquivo passa de 5 MB.', type: ErroApi })
  @SomenteAdmin()
  @NaoEncontrada('A estação informada em `estacaoId` não existe.')
  @Papeis(Papel.ADMIN)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @HttpCode(200)
  @UseInterceptors(uploadCsv)
  @Post('importar')
  importar(@UploadedFile() arquivo: Express.Multer.File | undefined, @Body() dto: ImportarLeiturasDto) {
    if (!arquivo) throw new BadRequestException('Envie um arquivo CSV no campo "arquivo".');
    return this.importacao.importar(arquivo.buffer, dto.estacaoId);
  }

  @ApiOperation({
    summary: 'Registrar leitura manualmente',
    description:
      '**Somente ADMIN.** Cadastra uma leitura avulsa (útil para testes). O `id` precisa ser único. ' +
      'A temperatura aceita de -50 a 150 °C com no máximo 1 casa decimal. ' +
      'Para enviar leituras de uma estação use **Ingestão → POST /ingestao/leituras**.',
  })
  @ApiCreatedResponse({ description: 'Leitura criada.', type: LeituraResposta })
  @Invalida()
  @SomenteAdmin()
  @Conflito('Já existe uma leitura com este id.')
  @Papeis(Papel.ADMIN)
  @Post()
  criar(@Body() dto: CriarLeituraDto) {
    return this.leiturasService.criar(dto);
  }
}
