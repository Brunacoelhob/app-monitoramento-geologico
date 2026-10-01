import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDate, IsEnum, IsNotEmpty, IsNumber, IsString, Max, MaxLength, Min } from 'class-validator';
import { Sentido } from '@prisma/client';

export class CriarLeituraDto {
  @ApiProperty({ description: 'Identificador único da leitura (até 100 caracteres). Repetir um id devolve 409.', example: 'leitura-2026-09-29-0001', maxLength: 100 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  id: string;

  @ApiProperty({ description: 'Nome da sala/ambiente medido (até 100 caracteres).', example: 'Sala de servidores', maxLength: 100 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  sala: string;

  @ApiProperty({ description: 'Data e hora da leitura (ISO 8601).', example: '2026-09-29T19:45:13Z', type: String, format: 'date-time' })
  @Type(() => Date)
  @IsDate()
  dataLeitura: Date;

  // Faixa plausivel para sensores; evita lixo no banco.
  @ApiProperty({ description: 'Temperatura em °C, com no máximo 1 casa decimal (faixa aceita: -50 a 150).', example: 22.4, minimum: -50, maximum: 150 })
  @IsNumber({ maxDecimalPlaces: 1 })
  @Min(-50)
  @Max(150)
  temperatura: number;

  @ApiProperty({ description: 'INTERNO ou EXTERNO.', enum: Sentido, enumName: 'Sentido', example: Sentido.INTERNO })
  @IsEnum(Sentido)
  sentido: Sentido;
}
