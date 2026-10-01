import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDateString, IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';
import { Origem, Sentido } from '@prisma/client';

// Filtros de consulta (todos validados no backend, nunca confiamos no front).
export class ConsultaLeiturasDto {
  @ApiPropertyOptional({ description: 'Data inicial (AAAA-MM-DD), inclusive.', example: '2026-09-01' })
  @IsOptional()
  @IsDateString({ strict: true })
  inicio?: string;

  @ApiPropertyOptional({ description: 'Data final (AAAA-MM-DD), inclusive.', example: '2026-09-30' })
  @IsOptional()
  @IsDateString({ strict: true })
  fim?: string;

  @ApiPropertyOptional({ description: 'INTERNO (dentro do ambiente) ou EXTERNO (fora).', enum: Sentido, enumName: 'Sentido', example: Sentido.INTERNO })
  @IsOptional()
  @IsEnum(Sentido)
  sentido?: Sentido;

  // RN-06: da para separar leituras reais das simuladas e escolher a estacao
  @ApiPropertyOptional({ description: 'Somente leituras desta estação (id em GET /estacoes).', example: 4 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  estacaoId?: number;

  @ApiPropertyOptional({ description: 'REAL ou SIMULADO.', enum: Origem, enumName: 'Origem', example: Origem.REAL })
  @IsOptional()
  @IsEnum(Origem)
  origem?: Origem;

  @ApiPropertyOptional({ description: 'Número da página (começa em 1). Só vale em GET /leituras.', default: 1, minimum: 1, example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pagina: number = 1;

  // Teto de 100 por pagina protege o servidor de consultas gigantes.
  @ApiPropertyOptional({ description: 'Itens por página (1 a 100). Só vale em GET /leituras.', default: 50, minimum: 1, maximum: 100, example: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limite: number = 50;
}
