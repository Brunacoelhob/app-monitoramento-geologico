import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDateString, IsEnum, IsIn, IsInt, IsOptional } from 'class-validator';
import { Origem, Sentido } from '@prisma/client';

export const FORMATOS_RELATORIO = ['pdf', 'xlsx', 'csv'] as const;
export type FormatoRelatorio = (typeof FORMATOS_RELATORIO)[number];

export class ConsultaRelatorioDto {
  @ApiProperty({ description: 'Formato do arquivo: pdf, xlsx (Excel) ou csv.', enum: FORMATOS_RELATORIO, example: 'xlsx' })
  @IsIn(FORMATOS_RELATORIO)
  formato: FormatoRelatorio;

  @ApiPropertyOptional({ description: 'Data inicial (AAAA-MM-DD), inclusive.', example: '2026-09-01' })
  @IsOptional()
  @IsDateString({ strict: true })
  inicio?: string;

  @ApiPropertyOptional({ description: 'Data final (AAAA-MM-DD), inclusive.', example: '2026-09-30' })
  @IsOptional()
  @IsDateString({ strict: true })
  fim?: string;

  @ApiPropertyOptional({ description: 'INTERNO ou EXTERNO.', enum: Sentido, enumName: 'Sentido', example: Sentido.INTERNO })
  @IsOptional()
  @IsEnum(Sentido)
  sentido?: Sentido;

  @ApiPropertyOptional({ description: 'Somente leituras desta estação (id em GET /estacoes).', example: 4 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  estacaoId?: number;

  @ApiPropertyOptional({ description: 'REAL ou SIMULADO.', enum: Origem, enumName: 'Origem', example: Origem.REAL })
  @IsOptional()
  @IsEnum(Origem)
  origem?: Origem;
}
