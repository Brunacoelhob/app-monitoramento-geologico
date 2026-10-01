import { INestApplication, applyDecorators } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
  ApiUnprocessableEntityResponse,
  DocumentBuilder,
  SwaggerModule,
} from '@nestjs/swagger';
import { ErroApi } from './respostas.dto';

// Nomes das tags: a ordem abaixo e a ordem das secoes na pagina.
export const TAGS = {
  auth: 'Autenticação',
  leituras: 'Temperatura',
  estacoes: 'Estações',
  ingestao: 'Ingestão',
  eventos: 'Sismos',
  alertas: 'Alertas',
  perfil: 'Perfil',
  saude: 'Saúde',
  usuarios: 'Usuários',
  tempoReal: 'Tempo real',
} as const;

const DESCRICAO_API = `
API do sistema de **monitoramento geológico**: temperatura das estações, terremotos (USGS, Japão em detalhe e
regiões do mundo), alertas por magnitude, estações com sismógrafo/GPS e o perfil do usuário.

## Como testar aqui (em 3 passos)
1. Abra **Autenticação → POST /auth/login**, clique em **Try it out**, informe e-mail e senha e execute.
2. O token é aplicado automaticamente ao cadeado **Authorize**. (Se preferir, cole o valor de \`token\` manualmente no botão Authorize.)
3. Execute qualquer rota protegida. Rotas com o cadeado fechado já estão autenticadas.

## Convenções
- **Datas**: \`AAAA-MM-DD\` nos filtros; \`AAAA-MM-DDThh:mm:ssZ\` (ISO 8601, UTC) nas respostas.
- **Origem dos dados**: \`REAL\` (sensor ou USGS) ou \`SIMULADO\` (gerado pelo simulador; sempre identificado).
- **Paginação**: \`pagina\` (começa em 1) e \`limite\`; a resposta traz \`total\`, \`pagina\`, \`limite\` e \`itens\`.
- **Papéis**: \`VISUALIZADOR\` lê; \`ADMIN\` também cria, altera e gerencia. Rotas de ADMIN indicam isso na descrição.
- **Limite de requisições**: 100/min por IP (mais rígido em login, troca de senha, relatórios e chave de estação).

## Status HTTP usados
| Código | Significado |
|---|---|
| 200 / 201 / 204 | Sucesso (204 = sucesso sem corpo) |
| 400 | Parâmetro ou corpo inválido (a lista \`message\` diz qual campo e o motivo) |
| 401 | Sem token, token expirado ou credenciais erradas |
| 403 | Autenticado, mas sem permissão (papel insuficiente ou estação inativa) |
| 404 | Recurso não encontrado |
| 409 | Conflito (duplicado ou estado que não permite a operação) |
| 422 | Dado válido, porém recusado pela regra (ex.: senha atual incorreta) |
| 429 | Muitas requisições; aguarde a janela de 1 minuto |

> Projeto de portfólio. Não é um sistema oficial de alerta sísmico.
`;

export function configurarSwagger(app: INestApplication, porta: number) {
  const documento = new DocumentBuilder()
    .setTitle('API de Monitoramento Geológico')
    .setDescription(DESCRICAO_API)
    .setVersion('1.0')
    .addServer(`http://localhost:${porta}`, 'Desenvolvimento local')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Token retornado por **POST /auth/login** (sem a palavra "Bearer"). Expira conforme JWT_EXPIRA.',
      },
      'bearer',
    )
    .addApiKey(
      {
        type: 'apiKey',
        name: 'x-chave-estacao',
        in: 'header',
        description: 'Chave de uma estação (formato `est_...`), gerada em **POST /estacoes** ou **POST /estacoes/{id}/chave**.',
      },
      'chave-estacao',
    )
    .addTag(TAGS.auth, 'Login e dados do usuário autenticado.')
    .addTag(TAGS.leituras, 'Leituras de temperatura (interno/externo): consulta, totais, série por hora, relatórios PDF/Excel/CSV e cadastro manual.')
    .addTag(TAGS.estacoes, 'Estações de monitoramento, seus sensores (temperatura, sismógrafo, GPS) e chaves de API. Escrita só para ADMIN.')
    .addTag(TAGS.ingestao, 'Entrada de leituras enviadas pelas estações (sensor real ou simulador), autenticada pela chave da estação, sem login de usuário.')
    .addTag(TAGS.eventos, 'Terremotos importados do USGS: listagem, totais, série diária, mapa, regiões do mundo e relatórios.')
    .addTag(TAGS.alertas, 'Alertas gerados por magnitude (Japão) e por estação sem comunicação: consulta, reconhecimento e encerramento.')
    .addTag(TAGS.perfil, 'Dados do próprio usuário, senha, avatar e acervo de imagens (upload de arquivos).')
    .addTag(TAGS.usuarios, 'Gestão de contas pelo ADMIN: listar, criar, mudar papel e remover. Não há cadastro público.')
    .addTag(TAGS.tempoReal, 'Canal de avisos (SSE) para o painel se atualizar sem recarregar: alertas, sismos e leituras novas.')
    .addTag(TAGS.saude, 'Verificação de que a API e o banco estão no ar (usada pelo Docker e por monitores).')
    .build();

  SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, documento), {
    customSiteTitle: 'API Monitoramento Geológico · Documentação',
    jsonDocumentUrl: 'api/docs-json',
    customCss: CSS,
    customJsStr: JS,
    swaggerOptions: {
      persistAuthorization: true, // o token sobrevive a recarregar a pagina
      displayRequestDuration: true, // mostra quantos ms cada chamada levou
      docExpansion: 'none',
      filter: true, // caixa de busca por rota/tag
      tryItOutEnabled: true,
      defaultModelsExpandDepth: 0,
      defaultModelExpandDepth: 3,
      syntaxHighlight: { theme: 'monokai' },
    },
  });
}

// ---------- Decoradores reutilizaveis (evitam repetir respostas de erro em cada rota) ----------

const erro = (descricao: string) => ({ description: descricao, type: ErroApi });

// Toda rota de usuario logado: exige token e sofre o limite de requisicoes.
export const Autenticada = () =>
  applyDecorators(
    ApiBearerAuth('bearer'),
    ApiUnauthorizedResponse(erro('Token ausente, inválido ou expirado. Faça login em POST /auth/login.')),
    ApiTooManyRequestsResponse(erro('Limite de requisições excedido. Aguarde 1 minuto.')),
  );

export const SomenteAdmin = () => ApiForbiddenResponse(erro('O papel do usuário é VISUALIZADOR; esta operação exige ADMIN.'));

export const Invalida = (descricao = 'Parâmetros ou corpo inválidos. A lista `message` indica cada campo e o motivo.') =>
  ApiBadRequestResponse(erro(descricao));

export const NaoEncontrada = (descricao: string) => ApiNotFoundResponse(erro(descricao));
export const Conflito = (descricao: string) => ApiConflictResponse(erro(descricao));
export const Recusada = (descricao: string) => ApiUnprocessableEntityResponse(erro(descricao));

// ---------- Aparencia da pagina ----------

const CSS = `
.swagger-ui .topbar { display: none; }
.swagger-ui, .swagger-ui .opblock-tag, .swagger-ui .opblock .opblock-summary-description { font-family: Manrope, system-ui, -apple-system, 'Segoe UI', sans-serif; }
.swagger-ui .info { margin: 36px 0 24px; }
.swagger-ui .info .title { font-weight: 800; letter-spacing: -0.02em; }
.swagger-ui .info .description table { display: table; width: auto; }
.swagger-ui .info .description th, .swagger-ui .info .description td { padding: 6px 14px; border: 1px solid #e3e8f2; }
.swagger-ui .scheme-container { box-shadow: 0 6px 24px -12px rgba(15, 23, 42, .25); border-bottom: 1px solid #e3e8f2; }
.swagger-ui .opblock-tag { font-weight: 700; border-bottom: 1px solid #e3e8f2; }
.swagger-ui .opblock { border-radius: 14px; border-width: 1px; box-shadow: 0 6px 18px -14px rgba(15, 23, 42, .4); margin: 0 0 12px; }
.swagger-ui .opblock .opblock-summary { border-radius: 14px; }
.swagger-ui .opblock-summary-method { border-radius: 8px; min-width: 70px; font-weight: 800; }
.swagger-ui .btn { border-radius: 10px; }
.swagger-ui .btn.execute { background: #3b5bdb; border-color: #3b5bdb; }
.swagger-ui .btn.authorize { color: #3b5bdb; border-color: #3b5bdb; }
.swagger-ui .btn.authorize svg { fill: #3b5bdb; }
.swagger-ui select, .swagger-ui input[type=text], .swagger-ui textarea { border-radius: 8px; }
.swagger-ui .responses-inner h4, .swagger-ui .responses-inner h5 { font-weight: 700; }
.swagger-ui .model-box { border-radius: 10px; }
`;

// Depois de um login bem-sucedido, aplica o token ao cadeado "Authorize" sozinho.
const JS = `
(function () {
  var fetchOriginal = window.fetch;
  window.fetch = function () {
    var args = arguments;
    return fetchOriginal.apply(this, args).then(function (resposta) {
      try {
        var alvo = args[0] && args[0].url ? args[0].url : String(args[0]);
        if (/\\/auth\\/login(\\?|$)/.test(alvo) && resposta.ok && window.ui) {
          resposta.clone().json().then(function (dados) {
            if (dados && dados.token) {
              window.ui.authActions.authorize({
                bearer: { name: 'bearer', schema: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }, value: dados.token },
              });
            }
          });
        }
      } catch (e) {}
      return resposta;
    });
  };
})();
`;
