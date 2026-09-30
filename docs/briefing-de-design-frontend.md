# Briefing de design do frontend

Status: **proposta para aprovação**. Nenhuma tela foi construída a partir deste documento.
Este briefing **substitui** o redesign termográfico que está hoje no código (hero roxo e laranja, fontes Bricolage e Instrument Sans).

## 1. Decisões já tomadas

| Tema | Decisão |
|---|---|
| Acessibilidade | VLibras, contraste, daltonismo, dislexia, apoio a pessoas com deficiência visual, aumentar e diminuir fonte, controle de transições. Tudo numa **barra fixa no topo da tela**. |
| Navegação | Menu lateral recolhível + barra superior. |
| Hero | Largura total, imagem temática com animação sutil própria, h1 sofisticado, descrição discreta e só o necessário, botão (CTA) minimalista com hover moderno, transmitindo seriedade. |
| Home | Visão geral dos dois módulos (Temperatura e Sismos). |
| Gráficos | Em **abas dentro de cada módulo**. |
| Exportação | Um botão **acima dos gráficos**. |
| Cores | Base sóbria; cor viva só nos dados. |
| Tema | Claro, escuro e alto contraste. |
| Fundo do hero | Imagem temática + animação sutil própria, sem biblioteca pesada. |
| Tipografia | Serifa elegante nos títulos + sans legível no texto. |
| CTA do hero | Leva à visualização dos gráficos. |
| Estilo | Sóbrio e técnico. |

## 2. Estrutura de telas

```
┌──────────────────────────────────────────────────────────────┐
│ Barra de acessibilidade (fixa no topo)                        │
├───────────┬──────────────────────────────────────────────────┤
│ Menu      │ Barra superior: módulo atual, conta               │
│ lateral   ├──────────────────────────────────────────────────┤
│ (recolhe) │ HERO em largura total (imagem + h1 + CTA)          │
│           ├──────────────────────────────────────────────────┤
│ Início    │ Abas do módulo:  Resumo | Gráficos | (Mapa) | Dados│
│ Temperatura│                                                   │
│ Sismos    │ Conteúdo da aba                                    │
│ Alertas   │                                                   │
│ Estações  │                                                   │
│ Perfil    │                                                   │
└───────────┴──────────────────────────────────────────────────┘
```

- **Início:** hero + indicadores dos dois módulos lado a lado + mini-mapa do Japão + alertas abertos + estado das estações.
- **Temperatura:** abas Resumo, Gráficos e Dados.
- **Sismos:** abas Resumo, Gráficos, Mapa e Dados.
- **Alertas:** lista e detalhe (réplicas, histórico, estações próximas). O admin reconhece e encerra.
- **Estações:** lista com status online e séries. O admin cadastra e gera chaves.
- **Perfil:** como hoje.
- **Exportação:** botão acima dos gráficos (PDF, Excel, CSV) e, em cada gráfico, baixar a imagem (PNG).

## 3. Acessibilidade (barra fixa no topo)

| Recurso | Como funciona |
|---|---|
| VLibras | Widget oficial do governo; traduz o texto da página para Libras com avatar. |
| Tamanho da fonte | A- e A+ em 5 passos (de 87% a 150%). Todo o layout usa `rem`, então tudo escala junto. |
| Tema | Claro, escuro e alto contraste. O padrão segue o sistema. |
| Daltonismo | Protanopia, deuteranopia e tritanopia. Troca as **paletas** de gráficos, mapa e severidade (não é um filtro sobre a tela). Sempre há texto ou ícone junto da cor. |
| Dislexia | Troca toda a tipografia para OpenDyslexic, com mais espaçamento entre letras e linhas. |
| Reduzir animações | Desliga a animação do hero, transições e movimento. Já vem ligado quando o sistema pede "reduzir movimento". |
| Base WCAG AA | Contraste 4,5 a 1, teclado completo, foco visível, "pular para o conteúdo", rótulos para leitor de tela, gráficos com tabela equivalente. |

As escolhas ficam salvas no navegador.

## 4. Sistema visual

**Cor (base sóbria, vivas só nos dados).**

| Papel | Claro | Escuro |
|---|---|---|
| Fundo | `#F4F6F8` | `#0F1720` |
| Superfície | `#FFFFFF` | `#16212C` |
| Borda | `#D5DCE2` | `#2A3846` |
| Texto | `#15202B` | `#E8EEF3` |
| Texto secundário | `#51606E` | `#9AAAB8` |
| Ação (único acento) | `#2F5DA8` | `#7FA6E8` |
| Dado: interno (frio) | `#1B6A8A` | `#5BBCDB` |
| Dado: externo (calor) | `#D9480F` | `#FF9152` |

Severidade dos alertas (Atenção, Alto, Crítico): uma escala de âmbar a vinho, sempre acompanhada de **ícone com forma diferente** e do texto do nível. O **alto contraste** usa preto, branco e amarelo.

**Tipografia.**
- Títulos: **Newsreader** (serifa), em semibold. h1 do hero com `clamp(34px, 4.4vw, 56px)`, entrelinha 1,1.
- Texto e dados: **Atkinson Hyperlegible**, base de 16 px, entrelinha 1,6, linhas de até 70 caracteres.
- Números de medição com algarismos tabulares.

**Forma e profundidade.** Cantos de 6 a 8 px, bordas de 1 px, **sem sombras**, espaçamento generoso. A hierarquia vem do tamanho e do peso, não de efeitos.

**Movimento.** Só três coisas se movem sozinhas: o traço de sismógrafo do hero, o hover do botão e a troca de aba. Transições de 150 ms. Sem entradas com fade em cada bloco.

## 5. Hero

- Largura total da área de conteúdo, com a imagem de fundo e um escurecimento à esquerda para o texto.
- **Imagem:** ilustração própria, em SVG, do arquipélago do Japão com as placas tectônicas e um traço de sismógrafo animado por cima (canvas ou SVG leve). Pausa com "reduzir animações" e em telas pequenas.
- **H1** em serifa, curto e sem palavra destacada. **Descrição** de uma frase só.
- **CTA** minimalista: contorno fino com preenchimento que desliza no hover e foco visível. Leva à aba Gráficos do módulo.

## 6. Pontos que ainda preciso que você confirme

1. **CTA na Início:** não existe aba de gráficos na Início. Sugiro levar à aba **Gráficos de Sismos**, que é o assunto principal. Nos módulos, o botão leva à aba Gráficos do próprio módulo.
2. **"Largura total" do hero:** sugiro a largura toda da área de conteúdo, com o menu lateral ao lado. Se quiser por cima do menu, o hero vira tela cheia e o menu passa a ficar sobre ele.
3. **Leitura em voz alta:** para pessoas com deficiência visual, sugiro acrescentar um botão "Ler esta página" (síntese de voz do navegador), além do suporte a leitor de tela. Quer?
4. **Exportação na aba Dados:** além de acima dos gráficos, repetir o mesmo botão acima da tabela?

## 7. Riscos e limites

- **VLibras** depende de internet e do serviço do governo; não funciona offline e eu não consigo testá-lo de forma automatizada aqui.
- **OpenDyslexic** não está no Google Fonts. Eu o guardaria no próprio projeto (licença livre), o que aumenta um pouco o tamanho.
- O **mapa** usa imagens de mapa de um serviço externo, e os limites das placas vêm de um arquivo público. Vou conferir a licença antes de usar.
