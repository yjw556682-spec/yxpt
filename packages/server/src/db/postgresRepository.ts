import type { Sql } from 'postgres';
import type { ReplayMeta, TickEvent } from '@yxpt/shared-types';
import type {
  Repository,
  User,
  Bot,
  CodeVersion,
  Match,
  ReplayRecord,
  Ranking,
  RankingDelta,
} from '../repository.js';

interface UserRow {
  id: number;
  display_name: string;
  created_at: Date;
}

interface BotRow {
  id: number;
  owner_id: number | null;
  name: string;
  mode_id: string;
  bot_key_hash: string;
  is_public: boolean;
  created_at: Date;
}

interface CodeRow {
  id: number;
  bot_id: number;
  version: number;
  code: string;
  submitted_by: string;
  notes: string | null;
  created_at: Date;
}

interface MatchRow {
  id: number;
  mode_id: string;
  seed: number;
  challenger_bot_id: number;
  defender_bot_id: number;
  winner_bot_id: number | null;
  reason: string;
  excitement: number;
  is_ranked: boolean;
  created_at: Date;
}

interface ReplayRow {
  match_id: number;
  meta: ReplayMeta;
  events: TickEvent[];
}

interface RankingRow {
  bot_id: number;
  mode_id: string;
  score: number;
  wins: number;
  losses: number;
  draws: number;
}

function toUser(r: UserRow): User {
  return { id: r.id, displayName: r.display_name, createdAt: r.created_at };
}

function toBot(r: BotRow): Bot {
  return {
    id: r.id,
    ownerId: r.owner_id,
    name: r.name,
    modeId: r.mode_id,
    botKeyHash: r.bot_key_hash,
    isPublic: r.is_public,
    createdAt: r.created_at,
  };
}

function toCode(r: CodeRow): CodeVersion {
  return {
    id: r.id,
    botId: r.bot_id,
    version: r.version,
    code: r.code,
    submittedBy: r.submitted_by,
    notes: r.notes,
    createdAt: r.created_at,
  };
}

function toMatch(r: MatchRow): Match {
  return {
    id: r.id,
    modeId: r.mode_id,
    seed: r.seed,
    challengerBotId: r.challenger_bot_id,
    defenderBotId: r.defender_bot_id,
    winnerBotId: r.winner_bot_id,
    reason: r.reason,
    excitement: r.excitement,
    isRanked: r.is_ranked,
    createdAt: r.created_at,
  };
}

function toRanking(r: RankingRow): Ranking {
  return {
    botId: r.bot_id,
    modeId: r.mode_id,
    score: r.score,
    wins: r.wins,
    losses: r.losses,
    draws: r.draws,
  };
}

export class PostgresRepository implements Repository {
  constructor(private sql: Sql) {}

  async createUser(displayName: string): Promise<User> {
    const rows = await this.sql<UserRow[]>`
      INSERT INTO users (display_name) VALUES (${displayName})
      RETURNING id, display_name, created_at
    `;
    return toUser(rows[0]);
  }

  async createBot(ownerId: number, name: string, modeId: string, botKeyHash: string): Promise<Bot> {
    const rows = await this.sql<BotRow[]>`
      INSERT INTO bots (owner_id, name, mode_id, bot_key_hash)
      VALUES (${ownerId}, ${name}, ${modeId}, ${botKeyHash})
      RETURNING id, owner_id, name, mode_id, bot_key_hash, is_public, created_at
    `;
    return toBot(rows[0]);
  }

  async getBotByKeyHash(hash: string): Promise<Bot | null> {
    const rows = await this.sql<BotRow[]>`
      SELECT id, owner_id, name, mode_id, bot_key_hash, is_public, created_at
      FROM bots WHERE bot_key_hash = ${hash}
    `;
    return rows[0] ? toBot(rows[0]) : null;
  }

  async getBot(id: number): Promise<Bot | null> {
    const rows = await this.sql<BotRow[]>`
      SELECT id, owner_id, name, mode_id, bot_key_hash, is_public, created_at
      FROM bots WHERE id = ${id}
    `;
    return rows[0] ? toBot(rows[0]) : null;
  }

  async getLatestCode(botId: number): Promise<CodeVersion | null> {
    const rows = await this.sql<CodeRow[]>`
      SELECT id, bot_id, version, code, submitted_by, notes, created_at
      FROM code_versions
      WHERE bot_id = ${botId}
      ORDER BY version DESC LIMIT 1
    `;
    return rows[0] ? toCode(rows[0]) : null;
  }

  async publishCode(botId: number, code: string, submittedBy: string, notes?: string): Promise<CodeVersion> {
    const maxRow = await this.sql<{ next: number }[]>`
      SELECT COALESCE(MAX(version), 0) + 1 AS next
      FROM code_versions WHERE bot_id = ${botId}
    `;
    const nextVersion = maxRow[0].next;
    const rows = await this.sql<CodeRow[]>`
      INSERT INTO code_versions (bot_id, version, code, submitted_by, notes)
      VALUES (${botId}, ${nextVersion}, ${code}, ${submittedBy}, ${notes ?? null})
      RETURNING id, bot_id, version, code, submitted_by, notes, created_at
    `;
    return toCode(rows[0]);
  }

  async listMatches(botId: number, limit: number): Promise<Match[]> {
    const rows = await this.sql<MatchRow[]>`
      SELECT id, mode_id, seed, challenger_bot_id, defender_bot_id, winner_bot_id,
             reason, excitement, is_ranked, created_at
      FROM matches
      WHERE challenger_bot_id = ${botId} OR defender_bot_id = ${botId}
      ORDER BY id DESC LIMIT ${limit}
    `;
    return rows.map(toMatch);
  }

  async createMatch(data: {
    modeId: string;
    seed: number;
    challengerBotId: number;
    defenderBotId: number;
    winnerBotId: number | null;
    reason: string;
    excitement: number;
    isRanked: boolean;
  }): Promise<Match> {
    const rows = await this.sql<MatchRow[]>`
      INSERT INTO matches (mode_id, seed, challenger_bot_id, defender_bot_id,
                           winner_bot_id, reason, excitement, is_ranked)
      VALUES (${data.modeId}, ${data.seed}, ${data.challengerBotId},
              ${data.defenderBotId}, ${data.winnerBotId}, ${data.reason},
              ${data.excitement}, ${data.isRanked})
      RETURNING id, mode_id, seed, challenger_bot_id, defender_bot_id, winner_bot_id,
                reason, excitement, is_ranked, created_at
    `;
    return toMatch(rows[0]);
  }

  async getMatch(id: number): Promise<Match | null> {
    const rows = await this.sql<MatchRow[]>`
      SELECT id, mode_id, seed, challenger_bot_id, defender_bot_id, winner_bot_id,
             reason, excitement, is_ranked, created_at
      FROM matches WHERE id = ${id}
    `;
    return rows[0] ? toMatch(rows[0]) : null;
  }

  async getReplay(matchId: number): Promise<ReplayRecord | null> {
    const rows = await this.sql<ReplayRow[]>`
      SELECT match_id, meta, events FROM replays WHERE match_id = ${matchId}
    `;
    if (!rows[0]) return null;
    return {
      matchId: rows[0].match_id,
      meta: rows[0].meta,
      events: rows[0].events,
    };
  }

  async saveReplay(matchId: number, meta: ReplayMeta, events: TickEvent[]): Promise<void> {
    // postgres.js JSONValue type is overly strict — cast through unknown.
    const metaJson = this.sql.json(meta as unknown as never);
    const eventsJson = this.sql.json(events as unknown as never);
    await this.sql`
      INSERT INTO replays (match_id, meta, events)
      VALUES (${matchId}, ${metaJson}, ${eventsJson})
      ON CONFLICT (match_id) DO UPDATE SET meta = EXCLUDED.meta, events = EXCLUDED.events
    `;
  }

  async getRanking(botId: number, modeId: string): Promise<Ranking | null> {
    const rows = await this.sql<RankingRow[]>`
      SELECT bot_id, mode_id, score, wins, losses, draws
      FROM rankings WHERE bot_id = ${botId} AND mode_id = ${modeId}
    `;
    return rows[0] ? toRanking(rows[0]) : null;
  }

  async upsertRanking(botId: number, modeId: string, delta: RankingDelta): Promise<Ranking> {
    const winDelta = delta.wins || 0;
    const lossDelta = delta.losses || 0;
    const drawDelta = delta.draws || 0;
    const rows = await this.sql<RankingRow[]>`
      INSERT INTO rankings (bot_id, mode_id, score, wins, losses, draws)
      VALUES (${botId}, ${modeId}, ${1000 + delta.score}, ${winDelta}, ${lossDelta}, ${drawDelta})
      ON CONFLICT (bot_id) DO UPDATE
        SET score = rankings.score + ${delta.score},
            wins = rankings.wins + ${winDelta},
            losses = rankings.losses + ${lossDelta},
            draws = rankings.draws + ${drawDelta}
      RETURNING bot_id, mode_id, score, wins, losses, draws
    `;
    return toRanking(rows[0]);
  }

  async listRankings(modeId: string, limit: number): Promise<Ranking[]> {
    const rows = await this.sql<RankingRow[]>`
      SELECT bot_id, mode_id, score, wins, losses, draws
      FROM rankings WHERE mode_id = ${modeId}
      ORDER BY score DESC LIMIT ${limit}
    `;
    return rows.map(toRanking);
  }

  async listBotsByMode(modeId: string): Promise<Bot[]> {
    const rows = await this.sql<BotRow[]>`
      SELECT id, owner_id, name, mode_id, bot_key_hash, is_public, created_at
      FROM bots WHERE mode_id = ${modeId} AND is_public = true
    `;
    return rows.map(toBot);
  }

  async searchOpponents(modeId: string, query: string): Promise<Bot[]> {
    const like = `%${query}%`;
    const rows = await this.sql<BotRow[]>`
      SELECT id, owner_id, name, mode_id, bot_key_hash, is_public, created_at
      FROM bots
      WHERE mode_id = ${modeId} AND is_public = true AND name ILIKE ${like}
      ORDER BY name LIMIT 50
    `;
    return rows.map(toBot);
  }
}