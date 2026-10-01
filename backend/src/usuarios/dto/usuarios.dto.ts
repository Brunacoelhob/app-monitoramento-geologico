import { ApiProperty } from '@nestjs/swagger';
import { Papel } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsEmail, IsEnum, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class CriarUsuarioDto {
  @ApiProperty({ description: 'E-mail do novo usuário (vira minúsculo). É o login.', example: 'analista@empresa.com', maxLength: 254 })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsEmail()
  @MaxLength(254)
  email: string;

  @ApiProperty({
    description: 'Senha inicial: 10 a 72 caracteres, com pelo menos uma letra e um número. A pessoa pode trocá-la em Perfil.',
    example: 'senhaInicial2026',
    minLength: 10,
    maxLength: 72,
    format: 'password',
  })
  @IsString()
  @MinLength(10, { message: 'A senha inicial precisa ter pelo menos 10 caracteres.' })
  @MaxLength(72)
  @Matches(/(?=.*[A-Za-z])(?=.*\d)/, { message: 'A senha inicial precisa ter letras e numeros.' })
  senha: string;

  @ApiProperty({ description: 'VISUALIZADOR só consulta; ADMIN também gerencia.', enum: Papel, enumName: 'Papel', example: Papel.VISUALIZADOR })
  @IsEnum(Papel)
  papel: Papel;
}

export class AlterarPapelDto {
  @ApiProperty({ description: 'Novo papel do usuário.', enum: Papel, enumName: 'Papel', example: Papel.ADMIN })
  @IsEnum(Papel)
  papel: Papel;
}
