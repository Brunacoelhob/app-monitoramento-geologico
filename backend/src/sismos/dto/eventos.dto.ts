import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { EstadoAlerta, NivelAlerta, Origem, SituacaoEvento, TipoAlerta } from '@prisma/client';
import { Type } from 'class-transformer';
import { CODIGOS_REGIAO } from '../regioes';
import { IsDateString, IsEnum, IsIn, IsInt, IsNumber, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

// RN-23: filtros comuns do modulo de sismos.
export class FiltrosEventosDto {
  @ApiPropertyOptional({ description: 'Data inicial do período (AAAA-MM-DD), inclusive.', example: '2026-09-01' })
  @IsOptional()
  @IsDateString({ strict: true })
  inicio?: string;

  @ApiPropertyOptional({ description: 'Data final do período (AAAA-MM-DD), inclusive.', example: '2026-09-30' })
  @IsOptional()
  @IsDateString({ strict: true })
  fim?: string;

  @ApiPropertyOptional({ description: 'Magnitude mínima (0 a 10). Ex.: 5 traz só M5,0 ou mais.', example: 4.5, minimum: 0, maximum: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(10)
  magnitudeMin?: number;

  @ApiPropertyOptional({
    description: 'Nível do alerta gerado pelo sismo: ATENCAO (M4,5–5,4), ALTO (M5,5–6,4) ou CRITICO (M6,5+).',
    enum: NivelAlerta,
    enumName: 'NivelAlerta',
    example: NivelAlerta.ALTO,
  })
  @IsOptional()
  @IsEnum(NivelAlerta)
  nivel?: NivelAlerta;

  @ApiPropertyOptional({ description: 'REAL (USGS/sensor) ou SIMULADO (gerado pelo simulador).', enum: Origem, enumName: 'Origem', example: Origem.REAL })
  @IsOptional()
  @IsEnum(Origem)
  origem?: Origem;

  @ApiPropertyOptional({
    description: 'Região do mundo (caixa geográfica). Veja as regiões e seus códigos em GET /eventos/regioes.',
    enum: CODIGOS_REGIAO,
    example: 'JAPAO',
  })
  @IsOptional()
  @IsIn(CODIGOS_REGIAO)
  regiao?: string;

  @ApiPropertyOptional({ description: 'Somente eventos a até 300 km desta estação (id em GET /estacoes).', example: 4 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  estacaoId?: number;

  @ApiPropertyOptional({
    description: 'Situação do evento. Por padrão os CANCELADOS ficam de fora.',
    enum: SituacaoEvento,
    enumName: 'SituacaoEvento',
    example: SituacaoEvento.AUTOMATICO,
  })
  @IsOptional()
  @IsEnum(SituacaoEvento)
  situacao?: SituacaoEvento;
}

export class ConsultaEventosDto extends FiltrosEventosDto {
  @ApiPropertyOptional({ description: 'Número da página (começa em 1).', default: 1, minimum: 1, example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pagina: number = 1;

  @ApiPropertyOptional({ description: 'Itens por página (1 a 100).', default: 50, minimum: 1, maximum: 100, example: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limite: number = 50;
}

export class ConsultaRelatorioEventosDto extends FiltrosEventosDto {
  @ApiProperty({ description: 'Formato do arquivo baixado.', enum: ['pdf', 'xlsx', 'csv'], example: 'pdf' })
  @IsIn(['pdf', 'xlsx', 'csv'])
  formato: 'pdf' | 'xlsx' | 'csv';
}

export class ConsultaAlertasDto {
  @ApiPropertyOptional({ description: 'Estado do alerta.', enum: EstadoAlerta, enumName: 'EstadoAlerta', example: EstadoAlerta.ABERTO })
  @IsOptional()
  @IsEnum(EstadoAlerta)
  estado?: EstadoAlerta;

  @ApiPropertyOptional({ description: 'Nível do alerta.', enum: NivelAlerta, enumName: 'NivelAlerta', example: NivelAlerta.ALTO })
  @IsOptional()
  @IsEnum(NivelAlerta)
  nivel?: NivelAlerta;

  @ApiPropertyOptional({
    description: 'Tipo: SISMO (gerado por terremoto) ou SEM_COMUNICACAO (estação parou de enviar leituras).',
    enum: TipoAlerta,
    enumName: 'TipoAlerta',
    example: TipoAlerta.SISMO,
  })
  @IsOptional()
  @IsEnum(TipoAlerta)
  tipo?: TipoAlerta;

  @ApiPropertyOptional({ description: 'Número da página (começa em 1).', default: 1, minimum: 1, example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pagina: number = 1;

  @ApiPropertyOptional({ description: 'Itens por página (1 a 100).', default: 25, minimum: 1, maximum: 100, example: 25 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limite: number = 25;
}

export class EncerrarAlertaDto {
  @ApiPropertyOptional({
    description: 'Motivo do encerramento (até 300 caracteres). **Obrigatório** se o alerta ainda não foi reconhecido.',
    example: 'Sismo revisado pelo USGS: magnitude menor que a inicial.',
    maxLength: 300,
  })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  motivo?: string;
}

export class SeriesEstacaoDto {
  @ApiPropertyOptional({ description: 'Janela das séries, em horas (1 a 72).', default: 24, minimum: 1, maximum: 72, example: 24 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(72)
  horas: number = 24;
}
