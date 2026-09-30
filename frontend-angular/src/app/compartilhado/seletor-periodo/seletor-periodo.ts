import { Component, effect, input, output } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { hoje } from '../../core/filtros.servico';

// Campo de periodo: os campos sao somente leitura e o intervalo so muda pelo
// calendario, sem limite de dias.
@Component({
  selector: 'app-seletor-periodo',
  imports: [ReactiveFormsModule, MatDatepickerModule, MatFormFieldModule],
  template: `
    <mat-form-field appearance="outline" subscriptSizing="dynamic" (click)="seletor.open()">
      <mat-label>Período</mat-label>
      <mat-date-range-input [formGroup]="periodo" [rangePicker]="seletor" [min]="limites()?.min ?? null" [max]="limites()?.max ?? hoje">
        <input matStartDate formControlName="inicio" placeholder="Início" readonly />
        <input matEndDate formControlName="fim" placeholder="Fim" readonly (dateChange)="aoMudar()" />
      </mat-date-range-input>
      <mat-datepicker-toggle matIconSuffix [for]="seletor" />
      <mat-date-range-picker #seletor />
    </mat-form-field>
  `,
  styles: ':host { display: inline-block; } mat-form-field { width: 17.5rem; max-width: 100%; }',
})
export class SeletorPeriodo {
  readonly inicio = input<Date | null>(null);
  readonly fim = input<Date | null>(null);
  readonly limites = input<{ min: Date; max: Date } | null>(null);
  readonly alterado = output<{ inicio: Date; fim: Date }>();

  protected readonly hoje = hoje();
  protected readonly periodo = new FormGroup({
    inicio: new FormControl<Date | null>(null),
    fim: new FormControl<Date | null>(null),
  });

  constructor() {
    effect(() => this.periodo.setValue({ inicio: this.inicio(), fim: this.fim() }, { emitEvent: false }));
  }

  // So aplica quando o intervalo esta completo (inicio e fim escolhidos).
  protected aoMudar() {
    const { inicio, fim } = this.periodo.value;
    if (inicio && fim) this.alterado.emit({ inicio, fim });
  }
}
