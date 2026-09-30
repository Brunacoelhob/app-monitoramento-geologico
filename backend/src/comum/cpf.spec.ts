import { cpfValido } from './cpf';

describe('cpfValido', () => {
  it('aceita um CPF valido', () => {
    expect(cpfValido('52998224725')).toBe(true);
  });

  it('recusa digito verificador errado', () => {
    expect(cpfValido('52998224724')).toBe(false);
  });

  it('recusa sequencias repetidas', () => {
    expect(cpfValido('11111111111')).toBe(false);
  });

  it('recusa tamanho errado e texto', () => {
    expect(cpfValido('5299822472')).toBe(false);
    expect(cpfValido('529.982.247-25')).toBe(false);
  });
});
