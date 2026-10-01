import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional } from 'class-validator';

// Campos de texto que acompanham o arquivo (multipart/form-data)
export class ImportarLeiturasDto {
  @ApiPropertyOptional({
    description: 'Estação que recebe as leituras (id em GET /estacoes). Sem ele, vai para a estação padrão "Sala Admin (legado)".',
    example: 4,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  estacaoId?: number;
}
