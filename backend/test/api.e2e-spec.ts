// Testes de integracao: sobem a API inteira (mesma configuracao da producao) contra um banco de teste
// e chamam as rotas de verdade com HTTP. Cobrem o que os testes unitarios nao alcancam:
// login, permissoes por papel, ingestao com chave de estacao, fluxo de alertas e gestao de usuarios.

process.env.DATABASE_URL = process.env.DATABASE_URL_TESTE;
process.env.JWT_SECRET = 'segredo-de-teste-com-mais-de-32-caracteres-xx';
process.env.SISMOS_AGENDADOR = 'false'; // sem USGS, simulador nem tarefas em segundo plano
process.env.UPLOADS_DIR = 'uploads-teste';

import { NestExpressApplication } from '@nestjs/platform-express';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
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
});
