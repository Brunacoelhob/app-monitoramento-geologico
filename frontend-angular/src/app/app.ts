import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { BarraAcessibilidade } from './compartilhado/barra-acessibilidade/barra-acessibilidade';

// A barra de acessibilidade fica acima de tudo, inclusive do login.
@Component({
  imports: [RouterOutlet, BarraAcessibilidade],
  selector: 'app-root',
  template: '<app-barra-acessibilidade /><router-outlet />',
})
export class App {}
