import { EstadoAlerta, NivelAlerta, Origem, SituacaoEvento, TipoAlerta } from '@prisma/client';
import { Type } from 'class-transformer';
import { CODIGOS_REGIAO } from '../regioes';
import { IsDateString, IsEnum, IsIn, IsInt, IsNumber, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

// RN-23: filtros comuns do modulo de sismos.
export class FiltrosEventosDto {
  @IsOptional()
  @IsDateString({ strict: true })
  inicio?: string;

  @IsOptional()
  @IsDateString({ strict: true })
  fim?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(10)
  magnitudeMin?: number;

  @IsOptional()
  @IsEnum(NivelAlerta)
  nivel?: NivelAlerta;

  @IsOptional()
  @IsEnum(Origem)
  origem?: Origem;

  // Caixa geografica de uma regiao do mundo (ex.: JAPAO, ANDES)
  @IsOptional()
  @IsIn(CODIGOS_REGIAO)
  regiao?: string;

  // Eventos a ate 300 km desta estacao
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  estacaoId?: number;

  // Por padrao os cancelados ficam de fora
  @IsOptional()
  @IsEnum(SituacaoEvento)
  situacao?: SituacaoEvento;
}

export class ConsultaEventosDto extends FiltrosEventosDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pagina: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limite: number = 50;
}

export class ConsultaRelatorioEventosDto extends FiltrosEventosDto {
  @IsIn(['pdf', 'xlsx', 'csv'])
  formato: 'pdf' | 'xlsx' | 'csv';
}

export class ConsultaAlertasDto {
  @IsOptional()
  @IsEnum(EstadoAlerta)
  estado?: EstadoAlerta;

  @IsOptional()
  @IsEnum(NivelAlerta)
  nivel?: NivelAlerta;

  @IsOptional()
  @IsEnum(TipoAlerta)
  tipo?: TipoAlerta;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pagina: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limite: number = 25;
}

export class EncerrarAlertaDto {
  @IsOptional()
  @IsString()
  @MaxLength(300)
  motivo?: string;
}

export class SeriesEstacaoDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(72)
  horas: number = 24;
}
