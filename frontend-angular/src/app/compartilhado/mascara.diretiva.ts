import { Directive, ElementRef, inject, input } from '@angular/core';
import { NgControl } from '@angular/forms';

export type TipoMascara = 'cpf' | 'celular' | 'cep';

export const soDigitos = (valor: string | null | undefined): string => (valor ?? '').replace(/\D/g, '');

export function formatarCpf(valor: string | null | undefined): string {
  const d = soDigitos(valor).slice(0, 11);
  let texto = d.slice(0, 3);
  if (d.length > 3) texto += `.${d.slice(3, 6)}`;
  if (d.length > 6) texto += `.${d.slice(6, 9)}`;
  if (d.length > 9) texto += `-${d.slice(9, 11)}`;
  return texto;
}

// (11) 91234-5678
export function formatarCelular(valor: string | null | undefined): string {
  const d = soDigitos(valor).slice(0, 11);
  if (!d) return '';
  let texto = `(${d.slice(0, 2)}`;
  if (d.length > 2) texto += `) ${d.slice(2, 7)}`;
  if (d.length > 7) texto += `-${d.slice(7, 11)}`;
  return texto;
}

export function formatarCep(valor: string | null | undefined): string {
  const d = soDigitos(valor).slice(0, 8);
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
}

const FORMATADORES: Record<TipoMascara, (valor: string) => string> = {
  cpf: formatarCpf,
  celular: formatarCelular,
  cep: formatarCep,
};

// Mascara de digitacao para campos de formulario reativo: <input appMascara="cpf" formControlName="cpf">
// O controle guarda o texto ja formatado; use soDigitos() ao enviar para a API.
@Directive({
  selector: 'input[appMascara]',
  host: { '(input)': 'aoDigitar()', inputmode: 'numeric' },
})
export class Mascara {
  readonly appMascara = input.required<TipoMascara>();

  private readonly elemento = inject<ElementRef<HTMLInputElement>>(ElementRef);
  private readonly controle = inject(NgControl, { self: true, optional: true });

  protected aoDigitar(): void {
    const campo = this.elemento.nativeElement;
    const formatado = FORMATADORES[this.appMascara()](campo.value);
    if (formatado !== campo.value) campo.value = formatado;
    // emitModelToViewChange:false evita reescrever o campo (o cursor nao pula).
    this.controle?.control?.setValue(formatado, { emitModelToViewChange: false });
  }
}
