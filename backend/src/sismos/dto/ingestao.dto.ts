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
  @IsInt()
  sensorId: number;

  @IsDateString()
  instante: string;

  @IsOptional()
  @IsNumber()
  temperatura?: number;

  @IsOptional()
  @IsNumber()
  amplitude?: number;

  @IsOptional()
  @IsNumber()
  latitude?: number;

  @IsOptional()
  @IsNumber()
  longitude?: number;

  @IsOptional()
  @IsNumber()
  altitudeM?: number;

  @IsOptional()
  @IsNumber()
  deslocamentoLesteMm?: number;

  @IsOptional()
  @IsNumber()
  deslocamentoNorteMm?: number;
}

export class IngestaoDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(500, { message: 'Envie no máximo 500 leituras por chamada.' })
  @ValidateNested({ each: true })
  @Type(() => LeituraIngestaoDto)
  leituras: LeituraIngestaoDto[];
}
