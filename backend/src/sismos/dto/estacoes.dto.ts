import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Origem, Sentido, TipoSensor } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

export const PLACAS = ['PACIFICA', 'FILIPINAS', 'OKHOTSK', 'AMUR'];

export class SensorDto {
  @ApiProperty({ description: 'Tipo do sensor.', enum: TipoSensor, enumName: 'TipoSensor', example: TipoSensor.SISMOGRAFO })
  @IsEnum(TipoSensor)
  tipo: TipoSensor;

  @ApiProperty({ description: 'Nome do sensor (2 a 60 caracteres).', example: 'Sismógrafo vertical', minLength: 2, maxLength: 60 })
  @IsString()
  @Length(2, 60)
  nome: string;

  @ApiPropertyOptional({
    description: 'INTERNO ou EXTERNO. **Obrigatório** para sensores de TEMPERATURA e **proibido** nos demais.',
    enum: Sentido,
    enumName: 'Sentido',
    example: Sentido.INTERNO,
  })
  @IsOptional()
  @IsEnum(Sentido)
  sentido?: Sentido;
}

export class CriarEstacaoDto {
  @ApiProperty({
    description: 'Código único da estação: letras maiúsculas, números e hífen (2 a 30 caracteres).',
    example: 'JP-SENDAI',
    pattern: '^[A-Z0-9-]{2,30}$',
  })
  @Matches(/^[A-Z0-9-]{2,30}$/, { message: 'O código usa letras maiúsculas, números e hífen (2 a 30 caracteres).' })
  codigo: string;

  @ApiProperty({ description: 'Nome de exibição (2 a 80 caracteres).', example: 'Sendai', minLength: 2, maxLength: 80 })
  @IsString()
  @Length(2, 80)
  nome: string;

  @ApiPropertyOptional({ description: 'Latitude em graus decimais (-90 a 90).', example: 38.2682, minimum: -90, maximum: 90 })
  @IsOptional()
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude?: number;

  @ApiPropertyOptional({ description: 'Longitude em graus decimais (-180 a 180).', example: 140.8694, minimum: -180, maximum: 180 })
  @IsOptional()
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude?: number;

  @ApiPropertyOptional({ description: 'Placa tectônica sob a estação.', enum: PLACAS, example: 'PACIFICA' })
  @IsOptional()
  @IsIn(PLACAS)
  placa?: string;

  @ApiPropertyOptional({
    description: 'REAL (sensor físico) ou SIMULADO (alimentada pelo simulador). Padrão: REAL.',
    enum: Origem,
    enumName: 'Origem',
    default: Origem.REAL,
    example: Origem.SIMULADO,
  })
  @IsOptional()
  @IsEnum(Origem)
  origem?: Origem;

  @ApiProperty({
    description: 'Sensores da estação (1 a 10).',
    type: [SensorDto],
    minItems: 1,
    maxItems: 10,
    example: [
      { tipo: 'SISMOGRAFO', nome: 'Sismógrafo vertical' },
      { tipo: 'GPS', nome: 'GPS geodésico' },
      { tipo: 'TEMPERATURA', nome: 'Termômetro interno', sentido: 'INTERNO' },
    ],
  })
  @IsArray()
  @ArrayMinSize(1, { message: 'Informe ao menos um sensor.' })
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => SensorDto)
  sensores: SensorDto[];
}

export class AtualizarEstacaoDto {
  @ApiPropertyOptional({ description: 'Novo nome (2 a 80 caracteres).', example: 'Sendai (porto)', minLength: 2, maxLength: 80 })
  @IsOptional()
  @IsString()
  @Length(2, 80)
  nome?: string;

  @ApiPropertyOptional({ description: 'Latitude em graus decimais (-90 a 90).', example: 38.2682, minimum: -90, maximum: 90 })
  @IsOptional()
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude?: number;

  @ApiPropertyOptional({ description: 'Longitude em graus decimais (-180 a 180).', example: 140.8694, minimum: -180, maximum: 180 })
  @IsOptional()
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude?: number;

  @ApiPropertyOptional({ description: 'Placa tectônica sob a estação.', enum: PLACAS, example: 'PACIFICA' })
  @IsOptional()
  @IsIn(PLACAS)
  placa?: string;
}

export class SituacaoEstacaoDto {
  @ApiProperty({ description: 'true ativa a estação; false a desativa (deixa de receber leituras, o histórico é mantido).', example: false })
  @IsBoolean()
  ativa: boolean;
}
