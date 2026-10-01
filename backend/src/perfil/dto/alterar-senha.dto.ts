import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class AlterarSenhaDto {
  @ApiProperty({ description: 'Senha atual (confirmação de identidade).', example: 'senhaAtual123', maxLength: 72, format: 'password' })
  @IsString()
  @MinLength(1)
  @MaxLength(72)
  senhaAtual: string;

  // 72 e o limite do bcrypt. Exige letra e numero para nao aceitar senhas triviais.
  @ApiProperty({
    description: 'Nova senha: 8 a 72 caracteres, com pelo menos uma letra e um número, e diferente da atual.',
    example: 'novaSenha2026',
    minLength: 8,
    maxLength: 72,
    format: 'password',
  })
  @IsString()
  @MinLength(8, { message: 'A nova senha precisa ter pelo menos 8 caracteres.' })
  @MaxLength(72)
  @Matches(/(?=.*[A-Za-z])(?=.*\d)/, { message: 'A nova senha precisa ter letras e numeros.' })
  novaSenha: string;
}
