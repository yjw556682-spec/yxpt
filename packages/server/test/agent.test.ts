import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/index.js';
import { InMemoryRepository } from '../src/repository.js';

const REGISTER_CODE = `
function onTick(me, world) {
  if (me.canFire) return { action: "fire" };
  return { action: "turn", args: ["left"] };
}
`;

const PASSIVE_CODE = 'function onTick(me, world) { return null; }';

async function registerUser(app: FastifyInstance, displayName: string): Promise<{ botId: number; botKey: string }> {
  const res = await app.inject({
    method: 'POST',
    url: '/api/agent/users',
    payload: { displayName },
  });
  expect(res.statusCode).toBe(200);
  const body = res.json();
  return { botId: body.botId, botKey: body.botKey };
}

describe('Agent API', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp({ repository: new InMemoryRepository() });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('1. register a user and returns a botKey', async () => {
    const { botId, botKey } = await registerUser(app, 'alice');
    expect(botId).toBeTypeOf('number');
    expect(botKey).toMatch(/^bk_[0-9a-f]{32}$/);
  });

  it('2. publish code with bearer key', async () => {
    const { botId, botKey } = await registerUser(app, 'bob-code');
    const res = await app.inject({
      method: 'POST',
      url: '/api/agent/bot/code',
      headers: { authorization: `Bearer ${botKey}` },
      payload: { code: REGISTER_CODE, submittedBy: 'bob', notes: 'first version' },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.version).toBe(1);

    // bot context shows latest version
    const ctx = await app.inject({
      method: 'GET',
      url: '/api/agent/bot',
      headers: { authorization: `Bearer ${botKey}` },
    });
    expect(ctx.statusCode).toBe(200);
    expect(ctx.json().latestCodeVersion).toBe(1);
    expect(ctx.json().id).toBe(botId);
  });

  it('3. simulate returns a result without error (uses grid-duel by default)', async () => {
    const { botKey } = await registerUser(app, 'carol-sim');
    const res = await app.inject({
      method: 'POST',
      url: '/api/agent/bot/simulate',
      headers: { authorization: `Bearer ${botKey}` },
      payload: { seed: 12345, code: REGISTER_CODE },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.modeId).toBe('grid-duel');
    expect(body.seed).toBe(12345);
    expect(body.result).toBeDefined();
    expect(body.result.done).toBe(true);
    expect(typeof body.eventsCount).toBe('number');
    expect(body.replay).toBeDefined();
    expect(Array.isArray(body.replay.events)).toBe(true);
  });

  it('4. challenge a second bot: match persisted, winner score increased', async () => {
    const a = await registerUser(app, 'dave');
    const b = await registerUser(app, 'eve');

    await app.inject({
      method: 'POST',
      url: '/api/agent/bot/code',
      headers: { authorization: `Bearer ${a.botKey}` },
      payload: { code: REGISTER_CODE, submittedBy: 'dave' },
    });
    await app.inject({
      method: 'POST',
      url: '/api/agent/bot/code',
      headers: { authorization: `Bearer ${b.botKey}` },
      payload: { code: PASSIVE_CODE, submittedBy: 'eve' },
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/agent/bot/challenge',
      headers: { authorization: `Bearer ${a.botKey}` },
      payload: { opponentBotId: b.botId, seed: 777 },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.matchId).toBeTypeOf('number');
    expect(body.opponent.id).toBe(b.botId);
    expect(body.replayUrl).toMatch(/^\/api\/matches\/\d+\/agent\.json$/);

    // Match should be persisted — fetch via public endpoint
    const replayRes = await app.inject({
      method: 'GET',
      url: body.replayUrl,
    });
    expect(replayRes.statusCode).toBe(200);
    expect(replayRes.json().match.id).toBe(body.matchId);

    // Ranking invariant: scores are zero-sum (winner +20, loser -20)
    const daveCtx = await app.inject({
      method: 'GET',
      url: '/api/agent/bot',
      headers: { authorization: `Bearer ${a.botKey}` },
    });
    const daveRank = daveCtx.json().rank;
    const eveCtx = await app.inject({
      method: 'GET',
      url: '/api/agent/bot',
      headers: { authorization: `Bearer ${b.botKey}` },
    });
    const eveRank = eveCtx.json().rank;

    expect(daveRank.score + eveRank.score).toBe(2000);
    expect(daveRank.score).toBeGreaterThanOrEqual(eveRank.score);
  });

  it('5. leaderboard returns at least the registered bots', async () => {
    const a = await registerUser(app, 'frank');
    const b = await registerUser(app, 'grace');

    await app.inject({
      method: 'POST',
      url: '/api/agent/bot/code',
      headers: { authorization: `Bearer ${a.botKey}` },
      payload: { code: REGISTER_CODE, submittedBy: 'frank' },
    });
    await app.inject({
      method: 'POST',
      url: '/api/agent/bot/code',
      headers: { authorization: `Bearer ${b.botKey}` },
      payload: { code: PASSIVE_CODE, submittedBy: 'grace' },
    });

    await app.inject({
      method: 'POST',
      url: '/api/agent/bot/challenge',
      headers: { authorization: `Bearer ${a.botKey}` },
      payload: { opponentBotId: b.botId, seed: 1 },
    });

    const res = await app.inject({
      method: 'GET',
      url: '/api/agent/leaderboard?mode=grid-duel',
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.mode).toBe('grid-duel');
    expect(Array.isArray(body.rankings)).toBe(true);
    const ids = body.rankings.map((r: { botId: number }) => r.botId);
    expect(ids).toContain(a.botId);
    expect(ids).toContain(b.botId);
  });

  it('6. rate limit: second simulate within 2s returns 429', async () => {
    const { botKey } = await registerUser(app, 'henry-rate');
    const first = await app.inject({
      method: 'POST',
      url: '/api/agent/bot/simulate',
      headers: { authorization: `Bearer ${botKey}` },
      payload: { seed: 1 },
    });
    expect(first.statusCode).toBe(200);

    const second = await app.inject({
      method: 'POST',
      url: '/api/agent/bot/simulate',
      headers: { authorization: `Bearer ${botKey}` },
      payload: { seed: 2 },
    });
    expect(second.statusCode).toBe(429);
    expect(second.json().error).toMatch(/rate limited/);
  });

  it('7. auth: request without bearer returns 401', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/agent/bot',
    });
    expect(res.statusCode).toBe(401);
  });

  it('auth: invalid bearer returns 401', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/agent/bot',
      headers: { authorization: 'Bearer bk_deadbeef' },
    });
    expect(res.statusCode).toBe(401);
  });

  it('list matches returns recent matches for the bot', async () => {
    const a = await registerUser(app, 'ivy-matches');
    const b = await registerUser(app, 'jack-matches');

    await app.inject({
      method: 'POST',
      url: '/api/agent/bot/code',
      headers: { authorization: `Bearer ${a.botKey}` },
      payload: { code: REGISTER_CODE, submittedBy: 'ivy' },
    });
    await app.inject({
      method: 'POST',
      url: '/api/agent/bot/code',
      headers: { authorization: `Bearer ${b.botKey}` },
      payload: { code: PASSIVE_CODE, submittedBy: 'jack' },
    });

    await app.inject({
      method: 'POST',
      url: '/api/agent/bot/challenge',
      headers: { authorization: `Bearer ${a.botKey}` },
      payload: { opponentBotId: b.botId, seed: 42 },
    });

    const res = await app.inject({
      method: 'GET',
      url: '/api/agent/bot/matches?limit=5',
      headers: { authorization: `Bearer ${a.botKey}` },
    });
    expect(res.statusCode).toBe(200);
    const matches = res.json().matches;
    expect(matches.length).toBeGreaterThan(0);
    expect(matches[0].challengerBotId).toBe(a.botId);
  });

  it('search opponents returns bots matching query in same mode', async () => {
    const u1 = await registerUser(app, 'unique-name-alpha');
    const u2 = await registerUser(app, 'unique-name-beta');

    const res = await app.inject({
      method: 'GET',
      url: '/api/agent/opponents?mode=grid-duel&q=unique-name-alpha',
    });
    expect(res.statusCode).toBe(200);
    const opponents = res.json().opponents;
    expect(opponents.length).toBeGreaterThan(0);
    expect(opponents.find((o: { id: number }) => o.id === u1.botId)).toBeDefined();
    expect(opponents.find((o: { id: number }) => o.id === u2.botId)).toBeUndefined();
  });
});