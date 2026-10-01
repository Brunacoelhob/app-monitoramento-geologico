import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({ description: 'E-mail da conta (não diferencia maiúsculas de minúsculas).', example: 'admin@iot.local', maxLength: 254 })
  @IsEmail()
  @MaxLength(254)
  email: string;

  // Limite maximo evita enviar senhas gigantes so para gastar CPU no bcrypt.
  @ApiProperty({ description: 'Senha da conta (até 72 caracteres).', example: 'sua-senha-aqui', minLength: 1, maxLength: 72, format: 'password' })
  @IsString()
  @MinLength(1)
  @MaxLength(72)
  senha: string;
}
