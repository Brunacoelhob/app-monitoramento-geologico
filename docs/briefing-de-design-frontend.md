# Guia de design do frontend

Status: **implementado**. Este documento descreve o design como ele está no código e **substitui** a primeira proposta (visual sóbrio com títulos em serifa), que foi trocada por um *dashboard moderno* depois de a primeira versão parecer antiga.

## 1. Direção

| Tema | Decisão |
|---|---|
| Estilo | **Dashboard moderno**: cartões arredondados com borda sutil, sombras suaves, ícones em blocos com degradê, abas em pílula, barra superior em vidro. Sério e técnico, sem enfeite. |
| Tipografia | **Manrope** em tudo (sem serifa), auto-hospedada. Peso 800 nos títulos, 500 a 700 no texto. |
| Cor | Base neutra; o acento (azul índigo) e as cores de dados aparecem onde há informação. Nível de alerta sempre com **ícone e forma**, nunca só cor. |
| Temas | Claro, escuro e alto contraste, mais 3 modos de daltonismo. Tudo definido por variáveis CSS na raiz (`src/styles.scss`). |
| Componentes | Angular Material com os tokens `--mat-*` sobrescritos; sem Bootstrap. |
| Movimento | Animações curtas e sutis; **todas** desligam com "reduzir animações" (ou a preferência do sistema). |

## 2. Estrutura das telas

```
┌──────────────────────────────────────────────────────────────┐
│ Barra de acessibilidade (fixa no topo)                        │
├───────────┬──────────────────────────────────────────────────┤
│ Menu      │ Barra superior: seção atual e conta               │
│ lateral   ├──────────────────────────────────────────────────┤
│ (recolhe) │ Início: HERO em largura total + visão geral        │
│           │ Demais telas: título + descrição (sem hero)        │
│ Início    │ Abas do módulo:  Resumo | Gráficos | Mapa | Dados  │
│ Temperatura│                                                   │
│ Sismos    │ Conteúdo da aba (exportar PDF/Excel/CSV no topo)   │
│ Alertas   │                                                   │
│ Estações  │                                                   │
│ Usuários* │   * só aparece para administradores                │
│ Perfil    │                                                   │
└───────────┴──────────────────────────────────────────────────┘
```

- **Hero** só na tela Início (imagem temática do Japão, traço de sismógrafo animado, título e um botão em pílula).
- **Exportação** sempre acima dos gráficos e tabelas.
- **Login:** palco escuro com globo animado (Vanta, só em telas largas e sem "reduzir animações") e cartão de entrada.
- **Alarme em tela cheia** para alertas Alto/Crítico (regra RN-32).

## 3. Acessibilidade

Barra fixa no topo, sempre visível (no celular, recolhida em um botão):

- Tamanho da fonte (A−, 100%, A+), tema, daltonismo, fonte de leitura (padrão, **OpenDyslexic** ou **Verdana**), reduzir animações e **ler a página** em voz alta. O **VLibras** é o botão tradicional do governo, na lateral direita (fora da barra).
- Preferências guardadas no navegador e aplicadas por atributos no `<html>` (`data-tema`, `data-daltonismo`, `data-fonte`, `data-movimento`).
- Gráficos e mapa leem as cores por um serviço (o ECharts e o Leaflet não leem variáveis CSS), então também respeitam tema e daltonismo.
- Cada gráfico tem **tabela equivalente** e o botão **Entenda este gráfico** (o que mostra, como ler, o que observar).
- Teclado completo, link "Pular para o conteúdo", landmarks e foco visível.
- Contraste conferido com **axe-core** (WCAG 2.0/2.1 A e AA) nas telas, nos temas claro e escuro.

## 4. Dados e honestidade visual

- Tudo que é simulado traz o selo **Simulado**, em telas, gráficos e relatórios.
- Aviso permanente no rodapé: projeto de portfólio, não é alerta oficial (RN-27).
- Horários do módulo de sismos em **JST**, sempre com o fuso indicado.

## 5. Onde mexer

| Quero mudar… | Arquivo |
|---|---|
| Cores, raios, tipografia, temas | `src/styles.scss` (tokens na raiz) |
| Cores de gráficos e mapa por tema | `src/app/core/acessibilidade.servico.ts` |
| Estilo comum dos gráficos | `src/app/compartilhado/grafico/estilo-grafico.ts` |
| Menu e estrutura | `src/app/layout/estrutura/` |
| Barra de acessibilidade | `src/app/compartilhado/barra-acessibilidade/` |
| Alarme em tela cheia | `src/app/compartilhado/alarme/` e `src/app/core/alarme.servico.ts` |
