import { IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class AlterarSenhaDto {
  @IsString()
  @MinLength(1)
  @MaxLength(72)
  senhaAtual: string;

  // 72 e o limite do bcrypt. Exige letra e numero para nao aceitar senhas triviais.
  @IsString()
  @MinLength(8, { message: 'A nova senha precisa ter pelo menos 8 caracteres.' })
  @MaxLength(72)
  @Matches(/(?=.*[A-Za-z])(?=.*\d)/, { message: 'A nova senha precisa ter letras e numeros.' })
  novaSenha: string;
}
