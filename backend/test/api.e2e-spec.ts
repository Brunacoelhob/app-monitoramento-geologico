// Testes de integracao: sobem a API inteira (mesma configuracao da producao) contra um banco de teste
// e chamam as rotas de verdade com HTTP. Cobrem o que os testes unitarios nao alcancam:
// login, permissoes por papel, ingestao com chave de estacao, fluxo de alertas e gestao de usuarios.

process.env.DATABASE_URL = process.env.DATABASE_URL_TESTE;
process.env.JWT_SECRET = 'segredo-de-teste-com-mais-de-32-caracteres-xx';
process.env.SISMOS_AGENDADOR = 'false'; // sem USGS, simulador nem tarefas em segundo plano
process.env.UPLOADS_DIR = 'uploads-teste';

import { AddressInfo } from 'net';
import * as nodeHttp from 'http';
import { NestExpressApplication } from '@nestjs/platform-express';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { ThrottlerStorage } from '@nestjs/throttler';
import * as bcrypt from 'bcryptjs';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configurarApp } from '../src/configurar-app';
import { PrismaService } from '../src/prisma/prisma.service';
import { AlertasService } from '../src/sismos/alertas.service';

const SENHA = 'senhaDeTeste2026';

describe('API (integração)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let alertas: AlertasService;
  let http: ReturnType<typeof request>;
  let tokenAdmin: string;
  let tokenVisualizador: string;
  let idAdmin: number;

  // Zera os contadores do limite de requisicoes: os testes de importacao passam do limite real (10/min) de proposito
  const zerarLimites = () => {
    const armazem = app.get(ThrottlerStorage) as unknown as { storage: Map<string, unknown>; hitExpirations?: Map<string, unknown> };
    armazem.storage.clear();
    armazem.hitExpirations?.clear();
  };

  const admin = () => ({ Authorization: `Bearer ${tokenAdmin}` });
  const visualizador = () => ({ Authorization: `Bearer ${tokenVisualizador}` });

  beforeAll(async () => {
    const modulo = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = modulo.createNestApplication<NestExpressApplication>();
    configurarApp(app);
    await app.init();

    prisma = app.get(PrismaService);
    alertas = app.get(AlertasService);
    http = request(app.getHttpServer());

    const senhaHash = await bcrypt.hash(SENHA, 4);
    const a = await prisma.usuario.create({ data: { email: 'admin@teste.local', senhaHash, papel: 'ADMIN' } });
    const v = await prisma.usuario.create({ data: { email: 'visualizador@teste.local', senhaHash, papel: 'VISUALIZADOR' } });
    idAdmin = a.id;

    // Tokens assinados direto: o login tem limite de 5 tentativas por minuto e so ele e testado pela rota.
    const jwt = app.get(JwtService);
    tokenAdmin = await jwt.signAsync({ sub: a.id, email: a.email, papel: a.papel });
    tokenVisualizador = await jwt.signAsync({ sub: v.id, email: v.email, papel: v.papel });
  });

  afterAll(async () => {
    await app.close();
  });

  describe('saúde e segurança básica', () => {
    it('GET /api/saude é público e confirma o banco', async () => {
      const r = await http.get('/api/saude').expect(200);
      expect(r.body).toMatchObject({ status: 'ok', banco: 'ok' });
    });

    it('rotas protegidas sem token devolvem 401', async () => {
      await http.get('/api/estacoes').expect(401);
      await http.get('/api/alertas').expect(401);
      await http.get('/api/usuarios').expect(401);
    });

    it('token inválido devolve 401', async () => {
      await http.get('/api/estacoes').set('Authorization', 'Bearer lixo').expect(401);
    });

    it('não expõe o cabeçalho x-powered-by e envia cabeçalhos do helmet', async () => {
      const r = await http.get('/api/saude');
      expect(r.headers['x-powered-by']).toBeUndefined();
      expect(r.headers['x-content-type-options']).toBe('nosniff');
    });

    it('campos desconhecidos no corpo são rejeitados (400)', async () => {
      await http.post('/api/auth/login').send({ email: 'a@b.com', senha: 'x', extra: 1 }).expect(400);
    });
  });

  describe('autenticação', () => {
    it('login correto devolve token e usuário', async () => {
      const r = await http.post('/api/auth/login').send({ email: 'ADMIN@teste.local', senha: SENHA }).expect(200);
      expect(r.body.token).toEqual(expect.any(String));
      expect(r.body.usuario).toEqual({ email: 'admin@teste.local', papel: 'ADMIN' });
      expect(JSON.stringify(r.body)).not.toContain('senhaHash');
    });

    it('senha errada e e-mail inexistente dão a mesma mensagem (401)', async () => {
      const errada = await http.post('/api/auth/login').send({ email: 'admin@teste.local', senha: 'errada123' }).expect(401);
      const inexistente = await http.post('/api/auth/login').send({ email: 'ninguem@teste.local', senha: 'errada123' }).expect(401);
      expect(errada.body.message).toBe(inexistente.body.message);
    });

    it('GET /api/auth/eu devolve o usuário do token', async () => {
      const r = await http.get('/api/auth/eu').set(admin()).expect(200);
      expect(r.body).toMatchObject({ email: 'admin@teste.local', papel: 'ADMIN' });
    });
  });

  describe('permissões por papel', () => {
    const corpoEstacao = {
      codigo: 'TESTE-01',
      nome: 'Estação de teste',
      latitude: 38.2,
      longitude: 140.8,
      origem: 'SIMULADO',
      sensores: [{ tipo: 'SISMOGRAFO', nome: 'Sismógrafo' }],
    };

    it('visualizador lê, mas não cria estação (403)', async () => {
      await http.get('/api/estacoes').set(visualizador()).expect(200);
      await http.post('/api/estacoes').set(visualizador()).send(corpoEstacao).expect(403);
    });

    it('visualizador não acessa a gestão de usuários (403)', async () => {
      await http.get('/api/usuarios').set(visualizador()).expect(403);
    });

    it('admin cria estação e recebe a chave de API uma única vez', async () => {
      const r = await http.post('/api/estacoes').set(admin()).send(corpoEstacao).expect(201);
      expect(r.body.chave).toMatch(/^est_[0-9a-f]{48}$/);
      expect(r.body.temChave).toBe(true);
      const lista = await http.get('/api/estacoes').set(admin()).expect(200);
      expect(JSON.stringify(lista.body)).not.toContain(r.body.chave); // a chave nunca volta nas consultas
    });

    it('código de estação repetido devolve 409', async () => {
      await http.post('/api/estacoes').set(admin()).send(corpoEstacao).expect(409);
    });

    it('sensor de temperatura sem sentido devolve 400', async () => {
      await http
        .post('/api/estacoes')
        .set(admin())
        .send({ ...corpoEstacao, codigo: 'TESTE-02', sensores: [{ tipo: 'TEMPERATURA', nome: 'Termômetro' }] })
        .expect(400);
    });
  });

  describe('ingestão de leituras (chave da estação)', () => {
    let chave: string;
    let sensorSismografo: number;
    let estacaoId: number;

    beforeAll(async () => {
      const criada = await http
        .post('/api/estacoes')
        .set(admin())
        .send({
          codigo: 'ING-01',
          nome: 'Estação de ingestão',
          origem: 'SIMULADO',
          sensores: [
            { tipo: 'SISMOGRAFO', nome: 'Sismógrafo' },
            { tipo: 'TEMPERATURA', nome: 'Termômetro', sentido: 'INTERNO' },
          ],
        })
        .expect(201);
      chave = criada.body.chave;
      estacaoId = criada.body.id;
      sensorSismografo = criada.body.sensores.find((s: { tipo: string }) => s.tipo === 'SISMOGRAFO').id;
    });

    const leitura = (instante: string, amplitude = 0.4) => ({ sensorId: sensorSismografo, instante, amplitude });
    const instante = () => new Date(Date.now() - 60_000).toISOString();

    it('sem chave ou com chave errada devolve 401', async () => {
      await http.post('/api/ingestao/leituras').send({ leituras: [leitura(instante())] }).expect(401);
      await http
        .post('/api/ingestao/leituras')
        .set('x-chave-estacao', 'est_chave-que-nao-existe-de-jeito-nenhum')
        .send({ leituras: [leitura(instante())] })
        .expect(401);
    });

    it('o token de usuário não substitui a chave da estação', async () => {
      await http.post('/api/ingestao/leituras').set(admin()).send({ leituras: [leitura(instante())] }).expect(401);
    });

    it('grava leituras válidas, ignora repetidas e rejeita as inválidas com o motivo', async () => {
      const quando = instante();
      const primeira = await http
        .post('/api/ingestao/leituras')
        .set('x-chave-estacao', chave)
        .send({ leituras: [leitura(quando), { sensorId: 999999, instante: quando, amplitude: 1 }] })
        .expect(200);
      expect(primeira.body.aceitas).toBe(1);
      expect(primeira.body.rejeitadas).toHaveLength(1);
      expect(primeira.body.rejeitadas[0]).toMatchObject({ indice: 1, motivo: 'Este sensor não pertence à estação.' });

      const repetida = await http.post('/api/ingestao/leituras').set('x-chave-estacao', chave).send({ leituras: [leitura(quando)] }).expect(200);
      expect(repetida.body).toMatchObject({ aceitas: 0, ignoradas: 1 });
    });

    it('lote vazio ou acima de 500 leituras devolve 400', async () => {
      await http.post('/api/ingestao/leituras').set('x-chave-estacao', chave).send({ leituras: [] }).expect(400);
      const muitas = Array.from({ length: 501 }, (_, i) => leitura(new Date(Date.now() - i * 1000).toISOString()));
      await http.post('/api/ingestao/leituras').set('x-chave-estacao', chave).send({ leituras: muitas }).expect(400);
    });

    it('nova chave invalida a anterior e estação inativa deixa de receber (403)', async () => {
      const nova = await http.post(`/api/estacoes/${estacaoId}/chave`).set(admin()).expect(201);
      await http.post('/api/ingestao/leituras').set('x-chave-estacao', chave).send({ leituras: [leitura(instante())] }).expect(401);

      await http.put(`/api/estacoes/${estacaoId}/situacao`).set(admin()).send({ ativa: false }).expect(200);
      await http.post('/api/ingestao/leituras').set('x-chave-estacao', nova.body.chave).send({ leituras: [leitura(instante())] }).expect(403);
    });
  });

  describe('alertas', () => {
    const criarEvento = (idExterno: string, magnitude: number, latitude: number, longitude: number) =>
      prisma.eventoSismico.create({
        data: { idExterno, magnitude, profundidadeKm: 30, latitude, longitude, local: `Teste ${idExterno}`, ocorridoEm: new Date() },
      });

    it('sismo forte no Japão abre alerta ALTO e sismo forte fora do Japão não abre', async () => {
      await alertas.processarEvento(await criarEvento('teste-japao-alto', 5.9, 38.3, 142.4));
      await alertas.processarEvento(await criarEvento('teste-chile-alto', 6.0, -33.0, -71.0));

      const r = await http.get('/api/alertas?estado=ABERTO&tipo=SISMO').set(visualizador()).expect(200);
      expect(r.body.itens).toHaveLength(1);
      expect(r.body.itens[0]).toMatchObject({ nivel: 'ALTO', estado: 'ABERTO' });
    });

    it('reprocessar o mesmo evento não cria um segundo alerta (idempotência)', async () => {
      const evento = await prisma.eventoSismico.findUniqueOrThrow({ where: { idExterno: 'teste-japao-alto' } });
      await alertas.processarEvento(evento);
      expect(await prisma.alerta.count({ where: { eventoId: evento.id } })).toBe(1);
    });

    it('reconhecer e encerrar seguem a máquina de estados e o papel', async () => {
      const { body } = await http.get('/api/alertas?estado=ABERTO').set(admin()).expect(200);
      const id = body.itens[0].id;

      await http.put(`/api/alertas/${id}/reconhecer`).set(visualizador()).expect(403);
      await http.put(`/api/alertas/${id}/reconhecer`).set(admin()).expect(200);
      await http.put(`/api/alertas/${id}/reconhecer`).set(admin()).expect(409); // só alerta aberto pode ser reconhecido

      await http.put(`/api/alertas/${id}/encerrar`).set(admin()).send({}).expect(200);
      await http.put(`/api/alertas/${id}/encerrar`).set(admin()).send({}).expect(409); // já encerrado

      const detalhe = await http.get(`/api/alertas/${id}`).set(admin()).expect(200);
      expect(detalhe.body.estado).toBe('ENCERRADO');
      expect(detalhe.body.historico.length).toBeGreaterThanOrEqual(3); // aberto, reconhecido, encerrado
    });

    it('encerrar alerta ainda não reconhecido exige o motivo (400)', async () => {
      await alertas.processarEvento(await criarEvento('teste-japao-critico', 6.8, 36.0, 141.0));
      const { body } = await http.get('/api/alertas?estado=ABERTO&nivel=CRITICO').set(admin()).expect(200);
      const id = body.itens[0].id;
      await http.put(`/api/alertas/${id}/encerrar`).set(admin()).send({}).expect(400);
      await http.put(`/api/alertas/${id}/encerrar`).set(admin()).send({ motivo: 'Revisado manualmente.' }).expect(200);
    });

    it('alerta inexistente devolve 404 e id inválido devolve 400', async () => {
      await http.get('/api/alertas/999999').set(admin()).expect(404);
      await http.get('/api/alertas/abc').set(admin()).expect(400);
    });
  });

  describe('eventos e regiões', () => {
    it('lista as regiões com as contagens do período', async () => {
      const r = await http.get('/api/eventos/regioes').set(visualizador()).expect(200);
      expect(r.body.regioes.find((x: { codigo: string }) => x.codigo === 'JAPAO').eventos).toBeGreaterThanOrEqual(2);
    });

    it('filtro por região e validação de parâmetros', async () => {
      const japao = await http.get('/api/eventos?regiao=JAPAO').set(visualizador()).expect(200);
      expect(japao.body.itens.every((e: { local: string }) => e.local.startsWith('Teste'))).toBe(true);
      await http.get('/api/eventos?regiao=ATLANTIDA').set(visualizador()).expect(400);
      await http.get('/api/eventos?magnitudeMin=99').set(visualizador()).expect(400);
      await http.get('/api/eventos?limite=1000').set(visualizador()).expect(400);
    });
  });

  describe('gestão de usuários (admin)', () => {
    let idCriado: number;

    it('cria usuário, normaliza o e-mail e nunca devolve a senha', async () => {
      const r = await http
        .post('/api/usuarios')
        .set(admin())
        .send({ email: 'Novo.Usuario@Teste.local', senha: 'senhaInicial2026', papel: 'VISUALIZADOR' })
        .expect(201);
      idCriado = r.body.id;
      expect(r.body.email).toBe('novo.usuario@teste.local');
      expect(JSON.stringify(r.body)).not.toMatch(/senha|hash/i);
    });

    it('e-mail repetido devolve 409 e senha fraca devolve 400', async () => {
      await http.post('/api/usuarios').set(admin()).send({ email: 'novo.usuario@teste.local', senha: 'senhaInicial2026', papel: 'ADMIN' }).expect(409);
      await http.post('/api/usuarios').set(admin()).send({ email: 'outro@teste.local', senha: 'curta', papel: 'ADMIN' }).expect(400);
      await http.post('/api/usuarios').set(admin()).send({ email: 'outro@teste.local', senha: 'somenteletrasaqui', papel: 'ADMIN' }).expect(400);
    });

    it('altera o papel de outra pessoa, mas não o próprio', async () => {
      const r = await http.put(`/api/usuarios/${idCriado}/papel`).set(admin()).send({ papel: 'ADMIN' }).expect(200);
      expect(r.body.papel).toBe('ADMIN');
      await http.put(`/api/usuarios/${idAdmin}/papel`).set(admin()).send({ papel: 'VISUALIZADOR' }).expect(400);
    });

    it('remove outra pessoa (204), mas não a própria conta; id inexistente devolve 404', async () => {
      await http.delete(`/api/usuarios/${idAdmin}`).set(admin()).expect(400);
      await http.delete(`/api/usuarios/${idCriado}`).set(admin()).expect(204);
      await http.delete(`/api/usuarios/${idCriado}`).set(admin()).expect(404);
    });
  });

  describe('perfil', () => {
    it('senha atual incorreta devolve 422 e nova senha fraca devolve 400', async () => {
      await http.put('/api/perfil/senha').set(visualizador()).send({ senhaAtual: 'errada', novaSenha: 'novaSenha2026' }).expect(422);
      await http.put('/api/perfil/senha').set(visualizador()).send({ senhaAtual: SENHA, novaSenha: 'curta' }).expect(400);
    });

    it('upload de arquivo que não é imagem é recusado (400)', async () => {
      await http
        .put('/api/perfil/avatar')
        .set(visualizador())
        .attach('arquivo', Buffer.from('isto nao e uma imagem, apesar da extensao'), { filename: 'foto.png', contentType: 'image/png' })
        .expect(400);
    });

    it('upload de imagem real é aceito e o avatar pode ser baixado', async () => {
      // PNG minimo valido (1x1)
      const png = Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
        'base64',
      );
      await http.put('/api/perfil/avatar').set(visualizador()).attach('arquivo', png, { filename: 'a.png', contentType: 'image/png' }).expect(204);
      const r = await http.get('/api/perfil/avatar').set(visualizador()).expect(200);
      expect(r.headers['content-type']).toContain('image/png');
      await http.delete('/api/perfil/avatar').set(visualizador()).expect(204);
    });
  });

  describe('importação de arquivo CSV (admin)', () => {
    beforeEach(zerarLimites);
    const csv = (...linhas: string[]) => Buffer.from(['sala;data_leitura;temperatura;sentido;id', ...linhas].join('\n'), 'utf-8');
    const enviar = (corpo: Buffer, nome = 'leituras.csv', quem = admin) =>
      http.post('/api/leituras/importar').set(quem()).attach('arquivo', corpo, { filename: nome, contentType: 'text/csv' });

    beforeAll(async () => {
      // A estação padrão ("legado") nasce numa migration, que o teste apaga ao zerar as tabelas
      await prisma.estacao.upsert({ where: { codigo: 'LEGADO-SALA-ADMIN' }, update: {}, create: { codigo: 'LEGADO-SALA-ADMIN', nome: 'Sala Admin (legado)', origem: 'REAL' } });
    });

    it('importa as linhas boas, recusa as ruins com a linha e o motivo, e é seguro reenviar', async () => {
      const arquivo = csv(
        'Sala T;29/09/2026 10:00;22,4;INTERNO;imp-teste-1',
        'Sala T;29/09/2026 10:00;27,1;EXTERNO;imp-teste-2',
        'Sala T;29/09/2026 10:05;999;INTERNO;imp-teste-3', // fora da faixa
        'Sala T;29/09/2026 10:10;21;lateral;imp-teste-4', // sentido invalido
        'Sala T;29/09/2026 10:15;20,5;INTERNO;imp-teste-5',
      );
      const r = await enviar(arquivo).expect(200);
      expect(r.body).toMatchObject({ linhasLidas: 5, importadas: 3, ignoradas: 0, totalRejeitadas: 2 });
      expect(r.body.rejeitadas.map((e: { linha: number }) => e.linha)).toEqual([4, 5]);

      const gravada = await prisma.leitura.findUniqueOrThrow({ where: { id: 'imp-teste-1' } });
      expect(Number(gravada.temperatura)).toBe(22.4);
      expect(gravada.estacaoId).not.toBeNull();

      const de_novo = await enviar(arquivo).expect(200);
      expect(de_novo.body).toMatchObject({ importadas: 0, ignoradas: 3, totalRejeitadas: 2 });
    });

    it('sem id no arquivo, cada linha recebe um id novo', async () => {
      const r = await enviar(csv('Sala U;29/09/2026 11:00;18;INTERNO;', 'Sala U;29/09/2026 11:00;18;INTERNO;')).expect(200);
      expect(r.body.importadas).toBe(2);
    });

    it('as leituras importadas aparecem nas consultas da API', async () => {
      const r = await http.get('/api/leituras?inicio=2026-09-29&fim=2026-09-29&limite=100').set(visualizador()).expect(200);
      expect(r.body.itens.filter((l: { sala: string }) => l.sala === 'Sala T')).toHaveLength(3);
    });

    it('permite escolher a estação; estação inexistente devolve 404', async () => {
      const est = await prisma.estacao.findFirstOrThrow({ where: { codigo: 'TESTE-01' } });
      await http.post('/api/leituras/importar').set(admin()).field('estacaoId', String(est.id))
        .attach('arquivo', csv('Sala V;29/09/2026 12:00;19;INTERNO;imp-teste-v'), { filename: 'v.csv', contentType: 'text/csv' }).expect(200);
      expect((await prisma.leitura.findUniqueOrThrow({ where: { id: 'imp-teste-v' } })).estacaoId).toBe(est.id);
      await http.post('/api/leituras/importar').set(admin()).field('estacaoId', '999999')
        .attach('arquivo', csv('Sala V;29/09/2026 12:00;19;INTERNO;x'), { filename: 'v.csv', contentType: 'text/csv' }).expect(404);
    });

    it('visualizador não importa (403) e sem token devolve 401', async () => {
      await enviar(csv('S;29/09/2026 10:00;20;INTERNO;z'), 'a.csv', visualizador).expect(403);
      await http.post('/api/leituras/importar').attach('arquivo', csv('x'), { filename: 'a.csv' }).expect(401);
    });

    it('recusa: sem arquivo, extensão errada, binário, cabeçalho errado e arquivo vazio (400)', async () => {
      await http.post('/api/leituras/importar').set(admin()).expect(400);
      await enviar(csv('S;29/09/2026 10:00;20;INTERNO;z'), 'planilha.xlsx').expect(400);
      await enviar(Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x00, 0x00, 0x00]), 'binario.csv').expect(400);
      await enviar(Buffer.from('coluna1,coluna2\n1,2'), 'errado.csv').expect(400);
      await enviar(Buffer.from(''), 'vazio.csv').expect(400);
    });

    it('arquivo acima de 5 MB devolve 413', async () => {
      await enviar(Buffer.alloc(5 * 1024 * 1024 + 10, 'a'), 'grande.csv').expect(413);
    });

    it('mais de 10 importações em 1 minuto devolvem 429', async () => {
      for (let i = 0; i < 10; i++) await enviar(csv(`S;29/09/2026 10:${String(i).padStart(2, '0')};20;INTERNO;lim-${i}`)).expect(200);
      await enviar(csv('S;29/09/2026 11:00;20;INTERNO;lim-x')).expect(429);
    });

    it('o modelo de CSV pode ser baixado e é aceito pela própria importação', async () => {
      const modelo = await http.get('/api/leituras/importar/modelo').set(visualizador()).expect(200);
      expect(modelo.headers['content-type']).toContain('text/csv');
      expect(modelo.headers['content-disposition']).toContain('modelo-importacao-leituras.csv');
      const r = await enviar(Buffer.from(modelo.text, 'utf-8'), 'modelo.csv').expect(200);
      expect(r.body.totalRejeitadas).toBe(0);
    });
  });

  describe('tempo real (SSE)', () => {
    let porta: number;
    beforeEach(zerarLimites);

    // Abre o canal e junta o que chega, ate o texto esperado aparecer (ou estourar o tempo)
    const ouvir = (token: string | null, esperar: RegExp, acao?: () => Promise<void>) =>
      new Promise<string>((resolver, rejeitar) => {
        const req = nodeHttp.get(
          { host: '127.0.0.1', port: porta, path: '/api/tempo-real', headers: token ? { Authorization: `Bearer ${token}` } : {} },
          (res) => {
            if (res.statusCode !== 200) {
              res.resume();
              return resolver(`status:${res.statusCode}`);
            }
            let texto = '';
            let disparou = false;
            const prazo = setTimeout(() => { req.destroy(); rejeitar(new Error(`Não chegou ${esperar}. Recebido: ${texto}`)); }, 8000);
            res.on('data', (parte) => {
              texto += parte.toString();
              if (!disparou && texto.includes('event: conectado') && acao) {
                disparou = true;
                void acao();
              }
              if (esperar.test(texto)) { clearTimeout(prazo); req.destroy(); resolver(texto); }
            });
          },
        );
        req.on('error', () => undefined);
      });

    beforeAll(async () => {
      await app.listen(0, '127.0.0.1');
      porta = (app.getHttpServer().address() as AddressInfo).port;
    });

    it('sem token o canal devolve 401', async () => {
      expect(await ouvir(null, /nunca/)).toBe('status:401');
    });

    it('com token abre o canal e avisa "conectado"', async () => {
      const texto = await ouvir(tokenVisualizador, /event: conectado/);
      expect(texto).toContain('event: conectado');
    });

    it('um alerta novo chega como evento "alerta" (sem dados sensíveis)', async () => {
      const evento = await prisma.eventoSismico.create({
        data: { idExterno: 'teste-sse-1', magnitude: 6.1, profundidadeKm: 20, latitude: 37.5, longitude: 141.5, local: 'Teste SSE', ocorridoEm: new Date() },
      });
      const texto = await ouvir(tokenVisualizador, /event: alerta/, () => alertas.processarEvento(evento));
      const dados = JSON.parse(/data: (\{.*\})/.exec(texto.slice(texto.indexOf('event: alerta')))![1]);
      expect(dados).toMatchObject({ acao: 'aberto' });
      expect(Object.keys(dados).sort()).toEqual(['acao', 'id']); // so diz O QUE mudou
    });

    it('a importação de CSV avisa "leituras"', async () => {
      const texto = await ouvir(tokenVisualizador, /event: leituras/, async () => {
        await http.post('/api/leituras/importar').set(admin())
          .attach('arquivo', Buffer.from('sala;data_leitura;temperatura;sentido;id\nSala W;29/09/2026 13:00;20;INTERNO;imp-sse-1'), { filename: 'w.csv', contentType: 'text/csv' });
      });
      expect(texto).toContain('event: leituras');
    });
  });
});
