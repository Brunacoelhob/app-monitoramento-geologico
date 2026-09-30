import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';
import { soDigitos } from './mascara.diretiva';

// Mesma regra do backend (dois digitos verificadores, sem sequencias repetidas).
export function cpfValido(cpf: string): boolean {
  if (!/^\d{11}$/.test(cpf) || /^(\d)\1{10}$/.test(cpf)) return false;
  const digito = (tamanho: number) => {
    let soma = 0;
    for (let i = 0; i < tamanho; i++) soma += Number(cpf[i]) * (tamanho + 1 - i);
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };
  return digito(9) === Number(cpf[9]) && digito(10) === Number(cpf[10]);
}

// Campos vazios ficam por conta do Validators.required.
export const validarCpf: ValidatorFn = (controle: AbstractControl): ValidationErrors | null => {
  const digitos = soDigitos(controle.value);
  return !digitos || cpfValido(digitos) ? null : { cpf: true };
};

// DDD + numero de 9 digitos comecando em 9.
export const validarCelular: ValidatorFn = (controle) => {
  const digitos = soDigitos(controle.value);
  return !digitos || /^\d{2}9\d{8}$/.test(digitos) ? null : { celular: true };
};

export const validarCep: ValidatorFn = (controle) => {
  const digitos = soDigitos(controle.value);
  return !digitos || digitos.length === 8 ? null : { cep: true };
};

// Letras e numeros, como exige o backend.
export const validarSenhaForte: ValidatorFn = (controle) => {
  const valor: string = controle.value ?? '';
  return !valor || (/[A-Za-z]/.test(valor) && /\d/.test(valor)) ? null : { senhaFraca: true };
};

// O campo deve ser igual a outro do mesmo grupo (ex.: confirmacao da nova senha).
// O erro fica no proprio campo para o mat-error conseguir mostra-lo.
export function igualA(outro: string): ValidatorFn {
  return (controle) => {
    const esperado = controle.parent?.get(outro)?.value;
    return controle.value === esperado ? null : { diferentes: true };
  };
}
