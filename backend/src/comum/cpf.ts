import { registerDecorator, ValidationOptions } from 'class-validator';

// Valida CPF pelos dois digitos verificadores (recebe so digitos).
export function cpfValido(cpf: string): boolean {
  if (!/^\d{11}$/.test(cpf)) return false;
  // 111.111.111-11 e afins passam na conta, mas nao sao CPFs reais.
  if (/^(\d)\1{10}$/.test(cpf)) return false;

  const digito = (tamanho: number) => {
    let soma = 0;
    for (let i = 0; i < tamanho; i++) soma += Number(cpf[i]) * (tamanho + 1 - i);
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };

  return digito(9) === Number(cpf[9]) && digito(10) === Number(cpf[10]);
}

export function IsCpf(opcoes?: ValidationOptions) {
  return (objeto: object, propriedade: string) =>
    registerDecorator({
      name: 'isCpf',
      target: objeto.constructor,
      propertyName: propriedade,
      options: { message: 'CPF invalido.', ...opcoes },
      validator: {
        validate: (valor: unknown) => typeof valor === 'string' && cpfValido(valor),
      },
    });
}
