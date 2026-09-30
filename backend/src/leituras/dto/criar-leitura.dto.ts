import { Type } from 'class-transformer';
import { IsDate, IsEnum, IsNotEmpty, IsNumber, IsString, Max, MaxLength, Min } from 'class-validator';
import { Sentido } from '@prisma/client';

export class CriarLeituraDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  id: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  sala: string;

  @Type(() => Date)
  @IsDate()
  dataLeitura: Date;

  // Faixa plausivel para sensores; evita lixo no banco.
  @IsNumber({ maxDecimalPlaces: 1 })
  @Min(-50)
  @Max(150)
  temperatura: number;

  @IsEnum(Sentido)
  sentido: Sentido;
}
