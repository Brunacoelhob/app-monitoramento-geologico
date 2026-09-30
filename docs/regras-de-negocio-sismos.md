# Regras de negócio: módulo de sismos (Japão)

Status: **aprovado e implementado no backend**. O frontend vem a seguir.

## Decisões já tomadas

| Tema | Decisão |
|---|---|
| Vínculo com temperatura | Uma **estação** tem vários sensores (temperatura, sismógrafo, GPS). O painel cruza os dados por estação e período. |
| Alertas | **Níveis fixos por magnitude.** Sem regras configuráveis pelo admin. |
| Permissões | **Admin** gerencia. **Visualizador** só consulta e baixa relatórios. |
| Dados | Sismos **reais do USGS** (região do Japão) + sismógrafo e GPS **simulados**, sempre marcados como "simulado". |
| Escopo | Projeto de portfólio. Região: Japão. |

## Glossário

- **Estação:** local físico (ex.: Tóquio) com um ou mais sensores.
- **Sensor:** equipamento de uma estação. Tipos: `TEMPERATURA`, `SISMOGRAFO`, `GPS`.
- **Leitura:** medição de um sensor em um instante.
- **Evento sísmico:** terremoto registrado (vem do USGS).
- **Alerta:** aviso aberto para a equipe tratar. Nasce de um evento ou de uma falha de comunicação.
- **Origem:** `REAL` (USGS ou dataset) ou `SIMULADO`.

## 1. Estações e sensores

- **RN-01.** Toda estação tem código único, nome, latitude, longitude e situação (ativa ou inativa).
- **RN-02.** Uma estação tem um ou mais sensores. Cada sensor tem um tipo e pertence a uma única estação.
- **RN-03.** O sensor de temperatura mantém o "sentido" atual (interno ou externo). As leituras de temperatura já existentes passam a pertencer a uma estação chamada "Sala Admin (legado)", com origem `REAL`.
- **RN-04.** Só o admin cria, edita, ativa e desativa estações e sensores.
- **RN-05.** Uma estação inativa não recebe leituras novas, mas o histórico dela continua consultável.

## 2. Origem dos dados

- **RN-06.** Todo evento e toda leitura têm origem. A interface mostra o selo **"simulado"** em tudo que for `SIMULADO`, em telas, gráficos e relatórios.
- **RN-07.** Eventos do USGS:
  - Região: Japão (latitude 24 a 46, longitude 122 a 146).
  - Magnitude mínima importada: 4,0.
  - Busca a cada 10 minutos.
  - O id do USGS identifica o evento: reimportar **nunca duplica**.
  - Se o USGS revisar os dados, o evento é atualizado. Se o USGS excluir o evento, ele fica `CANCELADO`.
- **RN-08.** O simulador gera leituras plausíveis:
  - Sismógrafo: ruído de fundo com picos quando há um evento real de M ≥ 5,0 a até 300 km da estação.
  - GPS: deslocamento em mm, com velocidade coerente com a placa da estação.
  - Todas as leituras simuladas têm origem `SIMULADO`.

## 3. Ingestão de leituras

- **RN-09.** Sensores e simulador enviam leituras com a **chave de API da estação**, não com o login de usuário. A chave é guardada só como hash e o admin pode gerar outra quando quiser.
- **RN-10.** Validações na entrada:
  - Horário não pode estar no futuro (tolerância de 5 minutos).
  - Valores dentro da faixa: temperatura de -60 a 80 °C, latitude de -90 a 90, longitude de -180 a 180.
  - Leitura repetida (mesmo sensor e mesmo instante) é ignorada.
- **RN-11.** Leitura atrasada é aceita até 24 horas. Depois disso, é rejeitada com a explicação do motivo.

## 4. Eventos e classificação

- **RN-12.** Todo evento guarda: id externo, magnitude, profundidade (km), latitude, longitude, local, data e hora (UTC), origem e situação (`AUTOMATICO`, `REVISADO` ou `CANCELADO`).
- **RN-13.** Níveis **fixos por magnitude**:

| Magnitude | Nível | Gera alerta? |
|---|---|---|
| menor que 4,5 | Registro | Não |
| de 4,5 a 5,4 | `ATENCAO` | Sim |
| de 5,5 a 6,4 | `ALTO` | Sim |
| 6,5 ou mais | `CRITICO` | Sim |

- **RN-14.** A profundidade é apenas informativa e não muda o nível.
- **RN-15.** Uma estação é considerada **próxima** de um evento quando a distância é de até **300 km** (cálculo pela superfície da Terra). O alerta lista as estações próximas.

## 5. Alertas

- **RN-16.** Todo evento com magnitude ≥ 4,5 gera **um** alerta. Reimportar o mesmo evento não cria outro.
- **RN-17.** Se o USGS revisar a magnitude e o nível mudar, o alerta é reclassificado e o histórico guarda o nível anterior. Se o evento for cancelado, o alerta é encerrado automaticamente com o motivo "evento cancelado".
- **RN-18.** Estados do alerta: `ABERTO` → `RECONHECIDO` → `ENCERRADO`. Também é permitido `ABERTO` → `ENCERRADO`, com motivo obrigatório. Não há reabertura: um novo evento gera um novo alerta.
- **RN-19.** Só o **admin** reconhece e encerra alertas. Cada mudança guarda quem fez e quando.
- **RN-20.** Encerramento automático: alerta `ATENCAO` ainda aberto **72 horas depois do sismo** é encerrado pelo sistema. O tempo conta desde a ocorrência do evento, e não desde a importação. Por isso, ao importar sismos antigos, os de nível Atenção já nascem prontos para encerrar. Alertas `ALTO` e `CRITICO` **nunca** se encerram sozinhos.
- **RN-21.** **Réplicas:** um evento dentro de **50 km** e **24 horas** de um alerta ainda aberto ou reconhecido, e com magnitude **menor ou igual** à do alerta, é anexado a ele como réplica, sem criar outro alerta. Se a magnitude for maior, vira alerta novo.
- **RN-22.** **Sem comunicação:** uma estação ativa sem nenhuma leitura há mais de **15 minutos** abre um alerta `ATENCAO` do tipo "sem comunicação". Ele se encerra sozinho na primeira leitura recebida.

## 6. Consultas e relatórios

- **RN-23.** Filtros do módulo: período, magnitude mínima, nível, origem e estação. O padrão é os **últimos 30 dias até hoje**, e o período é escolhido só pelo calendário, sem limite de dias (mesma regra do painel de temperatura).
- **RN-24.** Indicadores do painel: eventos no período, maior magnitude, alertas abertos por nível e estações online (com leitura nos últimos 15 minutos) sobre o total de estações ativas.
- **RN-25.** Relatório em PDF, Excel e CSV de eventos e alertas, respeitando os filtros. Máximo de 500 mil linhas em Excel e CSV. A origem (`REAL` ou `SIMULADO`) aparece em todas as linhas.

## 7. Segurança, avisos e formato

- **RN-26.** Só o admin grava (estações, sensores, chaves, alertas). Toda gravação exige login. A ingestão é a única exceção, e usa a chave da estação (RN-09).
- **RN-27.** Um aviso permanente na tela informa: *"Projeto de portfólio. Não é um sistema oficial de alerta sísmico. Para alertas oficiais, consulte a Agência Meteorológica do Japão (JMA)."*
- **RN-28.** Datas ficam guardadas em **UTC**. O módulo exibe em **horário do Japão (JST, UTC+9)** com essa indicação, e os relatórios trazem as duas colunas.
- **RN-29.** Retenção: leituras brutas de sismógrafo por 30 dias; eventos, alertas e demais leituras sem prazo.

## Valores configuráveis (ficam no `.env`, não no código)

| Parâmetro | Valor inicial |
|---|---|
| Magnitude mínima importada | 4,0 |
| Intervalo de busca no USGS | 10 min |
| Distância de estação próxima | 300 km |
| Janela de réplica | 50 km e 24 h |
| Encerramento automático do nível Atenção | 72 h |
| Tempo sem comunicação | 15 min |
| Atraso máximo de leitura | 24 h |

## Pontos que ainda preciso que você confirme

1. **Horário de exibição:** JST no módulo do Japão (RN-28) ou UTC como no de temperatura?
2. **Estações iniciais:** sugiro quatro, simuladas: Tóquio, Sendai, Osaka e Fukuoka. Pode ser outra lista?
3. **Réplicas (RN-21) e encerramento automático (RN-20):** são regras a mais para o portfólio mostrar domínio do problema. Mantém ou tira para simplificar?
4. **Retenção (RN-29):** ok guardar só 30 dias do sismógrafo bruto?

## Decisões tomadas na implementação

Pontos que o texto das regras deixava em aberto e como o backend os resolveu:

- **Magnitude revista para menos de 4,5:** o alerta é encerrado automaticamente, com o motivo "Magnitude revisada para abaixo de 4,5" (RN-17 só tratava de mudança de nível).
- **Tempo do alerta (RN-20):** conta desde o **sismo**, e não desde a importação. Sismos antigos de nível Atenção, ao serem importados, já são encerrados pela tarefa seguinte.
- **Encerrar alerta reconhecido:** o motivo é opcional. Só é obrigatório para encerrar um alerta ainda aberto (RN-18).
- **Estação "legado":** não tem chave de API (não recebe leituras) e não gera alerta de silêncio.
- **Alerta de silêncio (RN-22):** uma estação nova, sem nenhuma leitura, começa a contar o silêncio a partir do cadastro.
- **Estação próxima (RN-15):** calculada na hora, ao abrir o detalhe do alerta, e não gravada.
- **Filtro por estação (RN-23):** mostra os eventos a até 300 km dela.
- **Temperatura:** o painel de temperatura aceita `estacaoId` e `origem`, para nunca misturar leituras reais e simuladas sem marca.
- **Horários (RN-28):** a API devolve tudo em UTC; a conversão para JST é feita na tela e nos relatórios.
