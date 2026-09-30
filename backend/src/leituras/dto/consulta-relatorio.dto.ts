import { Type } from 'class-transformer';
import { IsDateString, IsEnum, IsIn, IsInt, IsOptional } from 'class-validator';
import { Origem, Sentido } from '@prisma/client';

export const FORMATOS_RELATORIO = ['pdf', 'xlsx', 'csv'] as const;
export type FormatoRelatorio = (typeof FORMATOS_RELATORIO)[number];

export class ConsultaRelatorioDto {
  @IsIn(FORMATOS_RELATORIO)
  formato: FormatoRelatorio;

  @IsOptional()
  @IsDateString({ strict: true })
  inicio?: string;

  @IsOptional()
  @IsDateString({ strict: true })
  fim?: string;

  @IsOptional()
  @IsEnum(Sentido)
  sentido?: Sentido;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  estacaoId?: number;

  @IsOptional()
  @IsEnum(Origem)
  origem?: Origem;
}
