import { Component, effect, inject } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { FiltrosServico, hoje } from '../../core/filtros.servico';
import { Sentido } from '../../core/modelos';

// Filtros de periodo e sentido. Escreve direto no FiltrosServico, entao
// qualquer pagina que use o servico reage sozinha quando o usuario muda algo.
@Component({
  selector: 'app-barra-filtros',
  imports: [ReactiveFormsModule, MatButtonToggleModule, MatDatepickerModule, MatFormFieldModule],
  templateUrl: './barra-filtros.html',
  styleUrl: './barra-filtros.scss',
})
export class BarraFiltros {
  protected readonly filtros = inject(FiltrosServico);
  protected readonly hoje = hoje();

  protected readonly periodo = new FormGroup({
    inicio: new FormControl<Date | null>(null),
    fim: new FormControl<Date | null>(null),
  });

  constructor() {
    // Quando o servico descobre o periodo disponivel, preenche o formulario.
    effect(() => {
      this.periodo.setValue(
        { inicio: this.filtros.inicio(), fim: this.filtros.fim() },
        { emitEvent: false },
      );
    });
  }

  // So aplica quando o intervalo esta completo (inicio e fim escolhidos).
  protected periodoAlterado(): void {
    const { inicio, fim } = this.periodo.value;
    if (inicio && fim) this.filtros.definirPeriodo(inicio, fim);
  }

  protected sentidosAlterados(sentidos: Sentido[]): void {
    this.filtros.definirSentidos(sentidos);
  }
}
