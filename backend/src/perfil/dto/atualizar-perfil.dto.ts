import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsIn, IsNotEmpty, IsOptional, IsString, Length, Matches, MaxLength } from 'class-validator';
import { IsCpf } from '../../comum/cpf';

export const UFS = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA',
  'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
];

const aparar = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
const soDigitos = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.replace(/\D/g, '') : value;

// Todos os campos sao obrigatorios, exceto complemento (validado tambem no front).
export class AtualizarPerfilDto {
  @ApiProperty({ description: 'Nome completo (3 a 100 caracteres).', example: 'Maria Souza', minLength: 3, maxLength: 100 })
  @Transform(aparar)
  @IsString()
  @Length(3, 100)
  nome: string;

  @ApiProperty({ description: 'CPF com dígitos verificadores válidos. Pontos e traço são aceitos e removidos.', example: '529.982.247-25' })
  @Transform(soDigitos)
  @IsCpf()
  cpf: string;

  // Celular com DDD: 11 digitos, comecando o numero com 9.
  @ApiProperty({ description: 'Celular com DDD: 11 dígitos, o número começa com 9. Máscara é aceita e removida.', example: '(11) 98765-4321' })
  @Transform(soDigitos)
  @Matches(/^\d{2}9\d{8}$/, { message: 'Celular invalido. Use DDD + 9 digitos.' })
  celular: string;

  @ApiProperty({ description: 'CEP com 8 dígitos. Máscara é aceita e removida.', example: '01310-100' })
  @Transform(soDigitos)
  @Matches(/^\d{8}$/, { message: 'CEP invalido.' })
  cep: string;

  @ApiProperty({ description: 'Rua/avenida (até 150 caracteres).', example: 'Avenida Paulista', maxLength: 150 })
  @Transform(aparar)
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  logradouro: string;

  @ApiProperty({ description: 'Número do imóvel (até 10 caracteres).', example: '1000', maxLength: 10 })
  @Transform(aparar)
  @IsString()
  @IsNotEmpty()
  @MaxLength(10)
  numero: string;

  @ApiPropertyOptional({ description: 'Complemento (opcional, até 60 caracteres).', example: 'Sala 12', maxLength: 60 })
  @IsOptional()
  @Transform(aparar)
  @IsString()
  @MaxLength(60)
  complemento?: string;

  @ApiProperty({ description: 'Bairro (até 80 caracteres).', example: 'Bela Vista', maxLength: 80 })
  @Transform(aparar)
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  bairro: string;

  @ApiProperty({ description: 'Cidade (até 80 caracteres).', example: 'São Paulo', maxLength: 80 })
  @Transform(aparar)
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  cidade: string;

  @ApiProperty({ description: 'Sigla do estado (UF), em maiúsculas ou minúsculas.', enum: UFS, example: 'SP' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toUpperCase() : value))
  @IsIn(UFS)
  uf: string;
}
