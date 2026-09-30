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
  @IsEnum(TipoSensor)
  tipo: TipoSensor;

  @IsString()
  @Length(2, 60)
  nome: string;

  // Obrigatorio para TEMPERATURA (validado no servico)
  @IsOptional()
  @IsEnum(Sentido)
  sentido?: Sentido;
}

export class CriarEstacaoDto {
  @Matches(/^[A-Z0-9-]{2,30}$/, { message: 'O código usa letras maiúsculas, números e hífen (2 a 30 caracteres).' })
  codigo: string;

  @IsString()
  @Length(2, 80)
  nome: string;

  @IsOptional()
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude?: number;

  @IsOptional()
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude?: number;

  @IsOptional()
  @IsIn(PLACAS)
  placa?: string;

  @IsOptional()
  @IsEnum(Origem)
  origem?: Origem;

  @IsArray()
  @ArrayMinSize(1, { message: 'Informe ao menos um sensor.' })
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => SensorDto)
  sensores: SensorDto[];
}

export class AtualizarEstacaoDto {
  @IsOptional()
  @IsString()
  @Length(2, 80)
  nome?: string;

  @IsOptional()
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude?: number;

  @IsOptional()
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude?: number;

  @IsOptional()
  @IsIn(PLACAS)
  placa?: string;
}

export class SituacaoEstacaoDto {
  @IsBoolean()
  ativa: boolean;
}
