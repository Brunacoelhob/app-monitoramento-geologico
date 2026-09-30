import { Type } from 'class-transformer';
import { IsDateString, IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';
import { Origem, Sentido } from '@prisma/client';

// Filtros de consulta (todos validados no backend, nunca confiamos no front).
export class ConsultaLeiturasDto {
  @IsOptional()
  @IsDateString({ strict: true })
  inicio?: string;

  @IsOptional()
  @IsDateString({ strict: true })
  fim?: string;

  @IsOptional()
  @IsEnum(Sentido)
  sentido?: Sentido;

  // RN-06: da para separar leituras reais das simuladas e escolher a estacao
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  estacaoId?: number;

  @IsOptional()
  @IsEnum(Origem)
  origem?: Origem;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pagina: number = 1;

  // Teto de 100 por pagina protege o servidor de consultas gigantes.
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limite: number = 50;
}
