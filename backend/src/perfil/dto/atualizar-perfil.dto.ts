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
  @Transform(aparar)
  @IsString()
  @Length(3, 100)
  nome: string;

  @Transform(soDigitos)
  @IsCpf()
  cpf: string;

  // Celular com DDD: 11 digitos, comecando o numero com 9.
  @Transform(soDigitos)
  @Matches(/^\d{2}9\d{8}$/, { message: 'Celular invalido. Use DDD + 9 digitos.' })
  celular: string;

  @Transform(soDigitos)
  @Matches(/^\d{8}$/, { message: 'CEP invalido.' })
  cep: string;

  @Transform(aparar)
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  logradouro: string;

  @Transform(aparar)
  @IsString()
  @IsNotEmpty()
  @MaxLength(10)
  numero: string;

  @IsOptional()
  @Transform(aparar)
  @IsString()
  @MaxLength(60)
  complemento?: string;

  @Transform(aparar)
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  bairro: string;

  @Transform(aparar)
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  cidade: string;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toUpperCase() : value))
  @IsIn(UFS)
  uf: string;
}
