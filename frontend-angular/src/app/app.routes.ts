import { Routes } from '@angular/router';
import { guardaAutenticado, guardaVisitante } from './core/auth.guard';

export const routes: Routes = [
  {
    path: 'login',
    canActivate: [guardaVisitante],
    loadComponent: () => import('./paginas/login/login').then((m) => m.Login),
  },
  {
    path: '',
    canActivate: [guardaAutenticado],
    loadComponent: () => import('./layout/estrutura/estrutura').then((m) => m.Estrutura),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'inicio' },
      {
        path: 'inicio',
        data: { titulo: 'Início', larguraTotal: true },
        loadComponent: () => import('./paginas/inicio/inicio').then((m) => m.Inicio),
      },
      {
        path: 'temperatura',
        data: { titulo: 'Temperatura' },
        loadComponent: () => import('./paginas/temperatura/modulo-temperatura').then((m) => m.ModuloTemperatura),
        children: [
          { path: '', pathMatch: 'full', loadComponent: () => import('./paginas/temperatura/resumo/resumo').then((m) => m.Resumo) },
          { path: 'graficos', loadComponent: () => import('./paginas/temperatura/graficos/graficos').then((m) => m.Graficos) },
          { path: 'dados', loadComponent: () => import('./paginas/leituras/leituras').then((m) => m.Leituras) },
        ],
      },
      { path: 'leituras', redirectTo: 'temperatura/dados' },
      {
        path: 'sismos',
        data: { titulo: 'Sismos' },
        loadComponent: () => import('./paginas/sismos/modulo-sismos').then((m) => m.ModuloSismos),
        children: [
          { path: '', pathMatch: 'full', loadComponent: () => import('./paginas/sismos/resumo/resumo').then((m) => m.Resumo) },
          { path: 'graficos', loadComponent: () => import('./paginas/sismos/graficos/graficos').then((m) => m.Graficos) },
          { path: 'mapa', loadComponent: () => import('./paginas/sismos/mapa/mapa').then((m) => m.Mapa) },
          { path: 'dados', loadComponent: () => import('./paginas/sismos/dados/dados').then((m) => m.Dados) },
        ],
      },
      {
        path: 'alertas',
        data: { titulo: 'Alertas' },
        loadComponent: () => import('./paginas/alertas/alertas').then((m) => m.Alertas),
      },
      {
        path: 'alertas/:id',
        data: { titulo: 'Alertas' },
        loadComponent: () => import('./paginas/alertas/alerta-detalhe').then((m) => m.AlertaDetalhe),
      },
      {
        path: 'estacoes',
        data: { titulo: 'Estações' },
        loadComponent: () => import('./paginas/estacoes/estacoes').then((m) => m.Estacoes),
      },
      {
        path: 'perfil',
        data: { titulo: 'Meu perfil' },
        loadComponent: () => import('./paginas/perfil/perfil').then((m) => m.Perfil),
      },
      { path: 'painel', redirectTo: 'temperatura' },
    ],
  },
  { path: '**', redirectTo: '' },
];
