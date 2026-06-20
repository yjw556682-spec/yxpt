import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import postgres from 'postgres';
import type { Sql } from 'postgres';
import { fileURLToPath } from 'node:url';
import { registerAgentRoutes } from './routes/agent.js';
import { createRateLimiter } from './ratelimit.js';
import { InMemoryRepository, type Repository } from './repository.js';
import { PostgresRepository } from './db/postgresRepository.js';
import { initDb } from './db/init.js';

export interface BuildAppOptions {
  repository?: Repository;
  rateLimiterWindowMs?: number;
  rateLimiterMaxActions?: number;
}

export interface StartServerOptions {
  port?: number;
  databaseUrl?: string;
}

export async function buildApp(opts: BuildAppOptions = {}): Promise<FastifyInstance> {
  const repository = opts.repository || new InMemoryRepository();
  const rateLimiter = createRateLimiter(
    opts.rateLimiterWindowMs ?? 2000,
    opts.rateLimiterMaxActions ?? 1,
  );

  const app = Fastify({
    logger: { level: process.env.LOG_LEVEL || 'info' },
  });

  await app.register(cors, { origin: true });

  app.get('/healthz', async () => ({ ok: true }));

  await registerAgentRoutes(app, { repository, rateLimiter });

  return app;
}

export async function startServer(opts: StartServerOptions = {}): Promise<void> {
  const databaseUrl = opts.databaseUrl || process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL env var is required to start the server');
  }
  const sql: Sql = postgres(databaseUrl);
  await initDb(sql);
  const repository = new PostgresRepository(sql);
  const app = await buildApp({ repository });
  const port = opts.port ?? parseInt(process.env.PORT || '3000', 10);
  await app.listen({ port, host: '0.0.0.0' });
}

export { InMemoryRepository, PostgresRepository };
export type { Repository } from './repository.js';
export { registerAgentRoutes } from './routes/agent.js';
export { createRateLimiter } from './ratelimit.js';

// Allow `node dist/index.js` / `tsx src/index.ts` to boot the server.
const isMain = process.argv[1] === fileURLToPath(import.meta.url);

if (isMain) {
  startServer().catch((err) => {
    console.error('failed to start server:', err);
    process.exit(1);
  });
}