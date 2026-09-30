import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

export class LoginDto {
  @IsEmail()
  @MaxLength(254)
  email: string;

  // Limite maximo evita enviar senhas gigantes so para gastar CPU no bcrypt.
  @IsString()
  @MinLength(1)
  @MaxLength(72)
  senha: string;
}
