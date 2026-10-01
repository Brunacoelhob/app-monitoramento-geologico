import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';

// Configuracao HTTP compartilhada entre a API real (main.ts) e os testes de integracao:
// assim os testes exercitam exatamente o mesmo prefixo, cabecalhos de seguranca e validacao.
export function configurarApp(app: NestExpressApplication) {
  const emProducao = process.env.NODE_ENV === 'production';

  app.setGlobalPrefix('api');
  // O CSP padrao do helmet bloqueia os scripts inline do Swagger UI, entao so e relaxado fora de producao.
  app.use(helmet({ contentSecurityPolicy: emProducao ? undefined : false }));
  app.disable('x-powered-by');

  // Somente as origens listadas em CORS_ORIGENS podem chamar a API pelo navegador.
  app.enableCors({
    origin: (process.env.CORS_ORIGENS ?? 'http://localhost:8080').split(','),
  });

  // Rejeita campos desconhecidos e converte tipos (query string vem como texto).
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
}
