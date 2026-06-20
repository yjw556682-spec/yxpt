import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { getMode, runMatch } from '@yxpt/engine';
import type { TickEvent } from '@yxpt/shared-types';
import type { Bot, Repository } from '../repository.js';
import { createBotKey, hashKey } from '../auth.js';
import type { RateLimiter } from '../ratelimit.js';

const DEFAULT_BOT_CODE = 'function onTick(me, world) { return { action: "skip" }; }';

interface RegisterBody {
  displayName: string;
}

interface CodeBody {
  code: string;
  notes?: string;
  submittedBy: string;
}

interface SimulateBody {
  opponentId?: number;
  seed?: number;
  code?: string;
}

interface ChallengeBody {
  opponentBotId?: number;
  randomOpponent?: boolean;
  seed?: number;
}

interface LeaderboardQuerystring {
  mode: string;
  period?: string;
}

interface OpponentsQuerystring {
  mode: string;
  q?: string;
}

interface MatchQuerystring {
  limit?: number;
}

interface AuthenticatedRequest extends FastifyRequest {
  bot?: Bot;
}

function authenticate(db: Repository) {
  return async function authHook(request: AuthenticatedRequest, reply: FastifyReply): Promise<void> {
    const auth = request.headers.authorization;
    if (!auth || !auth.startsWith('Bearer ')) {
      reply.code(401).send({ error: 'missing bearer token' });
      return;
    }
    const token = auth.slice('Bearer '.length).trim();
    const hash = hashKey(token);
    const bot = await db.getBotByKeyHash(hash);
    if (!bot) {
      reply.code(401).send({ error: 'invalid bot key' });
      return;
    }
    request.bot = bot;
  };
}

async function resolveCode(db: Repository, bot: Bot, override?: string): Promise<string> {
  if (override !== undefined) return override;
  const latest = await db.getLatestCode(bot.id);
  return latest?.code || DEFAULT_BOT_CODE;
}

function compactReplay(events: TickEvent[]): TickEvent[] {
  return events.slice(0, 200);
}

export interface AgentRoutesOptions {
  repository: Repository;
  rateLimiter: RateLimiter;
}

export async function registerAgentRoutes(app: FastifyInstance, opts: AgentRoutesOptions): Promise<void> {
  const { repository: db, rateLimiter } = opts;

  // Public route: create user + bot, returns botKey (plaintext) ONCE.
  app.post('/api/agent/users', async (request, reply) => {
    const body = request.body as RegisterBody;
    if (!body || typeof body.displayName !== 'string' || body.displayName.trim() === '') {
      return reply.code(400).send({ error: 'displayName is required' });
    }
    const user = await db.createUser(body.displayName.trim());
    const botKey = createBotKey();
    const bot = await db.createBot(user.id, `${user.displayName}'s bot`, 'grid-duel', hashKey(botKey));
    return reply.send({
      userId: user.id,
      displayName: user.displayName,
      botId: bot.id,
      botKey, // plaintext — shown ONCE
      modeId: bot.modeId,
    });
  });

  // Authenticated routes below
  app.register(async (authed) => {
    authed.addHook('preHandler', authenticate(db));

    authed.get('/api/agent/bot', async (request: AuthenticatedRequest) => {
      const bot = request.bot!;
      const ranking = await db.getRanking(bot.id, bot.modeId);
      const latest = await db.getLatestCode(bot.id);
      return {
        id: bot.id,
        name: bot.name,
        modeId: bot.modeId,
        ownerId: bot.ownerId,
        isPublic: bot.isPublic,
        createdAt: bot.createdAt,
        rank: ranking || { botId: bot.id, modeId: bot.modeId, score: 1000, wins: 0, losses: 0, draws: 0 },
        latestCodeVersion: latest?.version ?? null,
      };
    });

    authed.post('/api/agent/bot/code', async (request: AuthenticatedRequest, reply) => {
      const bot = request.bot!;
      const body = request.body as CodeBody;
      if (!body || typeof body.code !== 'string' || body.code.trim() === '') {
        return reply.code(400).send({ error: 'code is required' });
      }
      if (typeof body.submittedBy !== 'string' || body.submittedBy.trim() === '') {
        return reply.code(400).send({ error: 'submittedBy is required' });
      }
      const cv = await db.publishCode(bot.id, body.code, body.submittedBy.trim(), body.notes);
      return reply.send({ version: cv.version, createdAt: cv.createdAt });
    });

    authed.post('/api/agent/bot/simulate', async (request: AuthenticatedRequest, reply) => {
      const bot = request.bot!;
      if (!rateLimiter.check(bot.ownerId ?? bot.id)) {
        return reply.code(429).send({ error: 'rate limited — max 1 per 2s per user' });
      }
      const body = (request.body as SimulateBody) || {};
      const modeId = bot.modeId;
      const mode = getMode(modeId);

      const myCode = await resolveCode(db, bot, body.code);

      let opponentBot: Bot | null = null;
      if (body.opponentId !== undefined) {
        opponentBot = await db.getBot(body.opponentId);
        if (!opponentBot || !opponentBot.isPublic) {
          return reply.code(404).send({ error: 'opponent not found' });
        }
      } else {
        // pick first other public bot in the same mode
        const candidates = (await db.listBotsByMode(modeId)).filter(b => b.id !== bot.id);
        opponentBot = candidates[0] || null;
      }

      const opponentCode = opponentBot
        ? await resolveCode(db, opponentBot)
        : DEFAULT_BOT_CODE;
      const opponentName = opponentBot?.name || 'default';

      const seed = body.seed ?? Math.floor(Math.random() * 0x7fffffff);
      const replay = await runMatch(mode, [myCode, opponentCode], seed);

      return reply.send({
        modeId,
        seed,
        result: replay.result,
        eventsCount: replay.events.length,
        replay: { meta: replay.meta, result: replay.result, events: compactReplay(replay.events) },
        opponent: opponentName,
      });
    });

    authed.post('/api/agent/bot/challenge', async (request: AuthenticatedRequest, reply) => {
      const bot = request.bot!;
      if (!rateLimiter.check(bot.ownerId ?? bot.id)) {
        return reply.code(429).send({ error: 'rate limited — max 1 per 2s per user' });
      }
      const body = (request.body as ChallengeBody) || {};
      const modeId = bot.modeId;
      const mode = getMode(modeId);

      // Pick opponent
      let opponentBot: Bot | null = null;
      if (body.opponentBotId !== undefined) {
        opponentBot = await db.getBot(body.opponentBotId);
        if (!opponentBot || opponentBot.id === bot.id) {
          return reply.code(400).send({ error: 'opponent not found or is self' });
        }
      } else {
        const candidates = (await db.listBotsByMode(modeId)).filter(b => b.id !== bot.id);
        if (candidates.length === 0) {
          return reply.code(400).send({ error: 'no opponents available' });
        }
        opponentBot = candidates[Math.floor(Math.random() * candidates.length)];
      }

      const myCode = await resolveCode(db, bot);
      const opponentCode = await resolveCode(db, opponentBot);
      const seed = body.seed ?? Math.floor(Math.random() * 0x7fffffff);

      const replay = await runMatch(mode, [myCode, opponentCode], seed);
      const winnerBotId =
        replay.result.winner === null
          ? null
          : replay.result.winner === 0
            ? bot.id
            : opponentBot.id;

      const match = await db.createMatch({
        modeId,
        seed,
        challengerBotId: bot.id,
        defenderBotId: opponentBot.id,
        winnerBotId,
        reason: replay.result.reason,
        excitement: replay.events.filter(e => e.type === 'fire' || e.type === 'destroyed').length,
        isRanked: true,
      });

      await db.saveReplay(match.id, replay.meta, replay.events);

      // Update rankings (Elo-style)
      if (replay.result.winner !== null) {
        const winnerBot = replay.result.winner === 0 ? bot : opponentBot;
        const loserBot = replay.result.winner === 0 ? opponentBot : bot;
        await db.upsertRanking(winnerBot.id, modeId, { score: 20, wins: 1 });
        await db.upsertRanking(loserBot.id, modeId, { score: -20, losses: 1 });
      } else {
        await db.upsertRanking(bot.id, modeId, { score: 0, draws: 1 });
        await db.upsertRanking(opponentBot.id, modeId, { score: 0, draws: 1 });
      }

      return reply.send({
        matchId: match.id,
        modeId,
        seed,
        opponent: { id: opponentBot.id, name: opponentBot.name },
        result: replay.result,
        replayUrl: `/api/matches/${match.id}/agent.json`,
      });
    });

    authed.get('/api/agent/bot/matches', async (request: AuthenticatedRequest) => {
      const bot = request.bot!;
      const qs = request.query as MatchQuerystring;
      const limit = Math.min(Math.max(qs.limit ?? 10, 1), 100);
      const matches = await db.listMatches(bot.id, limit);
      return { matches };
    });
  });

  // Public routes (no auth)
  app.get('/api/agent/leaderboard', async (request, reply) => {
    const qs = request.query as LeaderboardQuerystring;
    if (!qs.mode) return reply.code(400).send({ error: 'mode query param required' });
    try {
      getMode(qs.mode);
    } catch {
      return reply.code(404).send({ error: 'unknown mode' });
    }
    const limit = 30;
    const rankings = await db.listRankings(qs.mode, limit);
    const enriched = await Promise.all(
      rankings.map(async (r) => {
        const bot = await db.getBot(r.botId);
        return { ...r, botName: bot?.name ?? '?', botId: r.botId };
      }),
    );
    return { mode: qs.mode, period: qs.period || 'all', rankings: enriched };
  });

  app.get('/api/agent/opponents', async (request, reply) => {
    const qs = request.query as OpponentsQuerystring;
    if (!qs.mode) return reply.code(400).send({ error: 'mode query param required' });
    try {
      getMode(qs.mode);
    } catch {
      return reply.code(404).send({ error: 'unknown mode' });
    }
    const opponents = qs.q
      ? await db.searchOpponents(qs.mode, qs.q)
      : await db.listBotsByMode(qs.mode);
    return { mode: qs.mode, opponents };
  });

  app.get('/api/matches/:id/agent.json', async (request, reply) => {
    const params = request.params as { id: string };
    const matchId = parseInt(params.id, 10);
    if (Number.isNaN(matchId)) return reply.code(400).send({ error: 'invalid match id' });
    const match = await db.getMatch(matchId);
    if (!match) return reply.code(404).send({ error: 'match not found' });
    const replay = await db.getReplay(matchId);
    if (!replay) return reply.code(404).send({ error: 'replay not found' });
    // Reconstruct result: winnerBotId -> player index (0 challenger, 1 defender)
    let winner: number | null = null;
    if (match.winnerBotId !== null) {
      winner = match.winnerBotId === match.challengerBotId ? 0 : 1;
    }
    return {
      meta: replay.meta,
      result: { done: true, winner, reason: match.reason as 'destroyed' | 'score' | 'timeout' | 'runtime' | 'error' | 'draw' },
      events: compactReplay(replay.events),
      match: {
        id: match.id,
        modeId: match.modeId,
        seed: match.seed,
        challengerBotId: match.challengerBotId,
        defenderBotId: match.defenderBotId,
        winnerBotId: match.winnerBotId,
        reason: match.reason,
        createdAt: match.createdAt,
      },
    };
  });
}