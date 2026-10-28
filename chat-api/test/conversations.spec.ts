import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { execSync } from 'node:child_process';
import { rmSync } from 'node:fs';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AgentClient, AgentReply, ChatTurn } from '../src/agent/agent.client';
import { AppModule } from '../src/app.module';

const TEST_DB = 'file:./data/test.db';

describe('Conversations API', () => {
  let app: INestApplication;
  const calls: { message: string; history: ChatTurn[] }[] = [];

  const fakeAgent: Partial<AgentClient> = {
    async query(message: string, history: ChatTurn[]): Promise<AgentReply> {
      calls.push({ message, history });
      return {
        answer: `Respuesta a: ${message}`,
        status: 'ok',
        model: 'fake',
        tool_calls: [{ name: 'get_race_results', args: { year: 2019 }, error: null }],
        consistency_suspects: [],
        latency_ms: 5,
        run_id: calls.length,
      };
    },
    isHealthy: async () => true,
  };

  beforeAll(async () => {
    rmSync('./data/test.db', { force: true });
    process.env.DATABASE_URL = TEST_DB;
    execSync('npx prisma migrate deploy', { env: { ...process.env, DATABASE_URL: TEST_DB }, stdio: 'ignore' });

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(AgentClient)
      .useValue(fakeAgent)
      .compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
    rmSync('./data/test.db', { force: true });
  });

  it('crea una conversación, guarda los mensajes y envía el historial al agente', async () => {
    const server = app.getHttpServer();
    const { body: conv } = await request(server).post('/api/conversations').send({}).expect(201);

    const first = await request(server)
      .post(`/api/conversations/${conv.id}/messages`)
      .send({ content: '¿Quién ganó en Monza 2019?' })
      .expect(201);
    expect(first.body.assistantMessage.metadata.toolCalls[0].name).toBe('get_race_results');

    await request(server)
      .post(`/api/conversations/${conv.id}/messages`)
      .send({ content: '¿Y el segundo?' })
      .expect(201);
    expect(calls[1].history.map((t) => t.role)).toEqual(['user', 'assistant']);

    const { body: full } = await request(server).get(`/api/conversations/${conv.id}`).expect(200);
    expect(full.title).toBe('¿Quién ganó en Monza 2019?');
    expect(full.messages).toHaveLength(4);

    const { body: list } = await request(server).get('/api/conversations').expect(200);
    expect(list[0].id).toBe(conv.id);
  });

  it('valida el cuerpo y devuelve 404 en conversaciones inexistentes', async () => {
    const server = app.getHttpServer();
    const { body: conv } = await request(server).post('/api/conversations').send({}).expect(201);
    await request(server).post(`/api/conversations/${conv.id}/messages`).send({ content: '' }).expect(400);
    await request(server).post(`/api/conversations/${conv.id}/messages`).send({ content: 'x', extra: 1 }).expect(400);
    await request(server).get('/api/conversations/nope').expect(404);
  });
});

describe('F1 data proxy', () => {
  it('reenvía la predicción al agente con el nombre de campo que espera', async () => {
    const { AppModule } = await import('../src/app.module');
    const proxied: { path: string; body?: unknown }[] = [];
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(AgentClient)
      .useValue({
        isHealthy: async () => true,
        request: async (_m: string, path: string, opts?: { body?: unknown }) => {
          proxied.push({ path, body: opts?.body });
          return { predicted_position: 4 };
        },
      })
      .compile();
    const app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();

    const body = { year: 2024, circuit: 'Autodromo Nazionale Monza', driver_number: 16, grid: 1, constructor_name: 'Ferrari' };
    await request(app.getHttpServer()).post('/api/f1/predictions').send(body).expect(201);
    expect(proxied[0]).toEqual({
      path: '/v1/predictions',
      body: { year: 2024, circuit: 'Autodromo Nazionale Monza', driver_number: 16, grid: 1, constructor: 'Ferrari' },
    });
    await request(app.getHttpServer()).post('/api/f1/predictions').send({ ...body, grid: 0 }).expect(400);
    await app.close();
  });
});
