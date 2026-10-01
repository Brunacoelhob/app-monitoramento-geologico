import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsInt,
  IsNumber,
  IsOptional,
  ValidateNested,
} from 'class-validator';

// Uma leitura enviada por um sensor. Os campos usados dependem do tipo do sensor
// (temperatura, amplitude ou posicao); a regra fina fica em validarLeitura().
export class LeituraIngestaoDto {
  @ApiProperty({ description: 'Id do sensor (veja os sensores em GET /estacoes). Precisa pertencer à estação da chave.', example: 12 })
  @IsInt()
  sensorId: number;

  @ApiProperty({ description: 'Instante da medição (ISO 8601, de preferência em UTC). Não pode estar no futuro.', example: '2026-09-29T19:45:13Z' })
  @IsDateString()
  instante: string;

  @ApiPropertyOptional({ description: '**Sensor de TEMPERATURA**: valor em °C.', example: 22.4 })
  @IsOptional()
  @IsNumber()
  temperatura?: number;

  @ApiPropertyOptional({ description: '**Sensor SISMOGRAFO**: amplitude do sinal.', example: 0.42 })
  @IsOptional()
  @IsNumber()
  amplitude?: number;

  @ApiPropertyOptional({ description: '**Sensor GPS** (obrigatório): latitude em graus decimais.', example: 38.2682 })
  @IsOptional()
  @IsNumber()
  latitude?: number;

  @ApiPropertyOptional({ description: '**Sensor GPS** (obrigatório): longitude em graus decimais.', example: 140.8694 })
  @IsOptional()
  @IsNumber()
  longitude?: number;

  @ApiPropertyOptional({ description: '**Sensor GPS**: altitude em metros.', example: 46.3 })
  @IsOptional()
  @IsNumber()
  altitudeM?: number;

  @ApiPropertyOptional({ description: '**Sensor GPS**: deslocamento para leste em mm desde a referência.', example: 1.8 })
  @IsOptional()
  @IsNumber()
  deslocamentoLesteMm?: number;

  @ApiPropertyOptional({ description: '**Sensor GPS**: deslocamento para norte em mm desde a referência.', example: -0.6 })
  @IsOptional()
  @IsNumber()
  deslocamentoNorteMm?: number;
}

export class IngestaoDto {
  @ApiProperty({
    description: 'Lote de leituras (1 a 500). Cada leitura é validada separadamente: as inválidas voltam em `rejeitadas` e as demais são gravadas.',
    type: [LeituraIngestaoDto],
    minItems: 1,
    maxItems: 500,
    example: [
      { sensorId: 12, instante: '2026-09-29T19:45:13Z', amplitude: 0.42 },
      { sensorId: 13, instante: '2026-09-29T19:45:13Z', latitude: 38.2682, longitude: 140.8694, altitudeM: 46.3, deslocamentoLesteMm: 1.8, deslocamentoNorteMm: -0.6 },
      { sensorId: 14, instante: '2026-09-29T19:45:13Z', temperatura: 22.4 },
    ],
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(500, { message: 'Envie no máximo 500 leituras por chamada.' })
  @ValidateNested({ each: true })
  @Type(() => LeituraIngestaoDto)
  leituras: LeituraIngestaoDto[];
}
