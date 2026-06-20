import type { ReplayMeta, TickEvent } from '@yxpt/shared-types';

export interface User {
  id: number;
  displayName: string;
  createdAt: Date;
}

export interface Bot {
  id: number;
  ownerId: number | null;
  name: string;
  modeId: string;
  botKeyHash: string;
  isPublic: boolean;
  createdAt: Date;
}

export interface CodeVersion {
  id: number;
  botId: number;
  version: number;
  code: string;
  submittedBy: string;
  notes: string | null;
  createdAt: Date;
}

export interface Match {
  id: number;
  modeId: string;
  seed: number;
  challengerBotId: number;
  defenderBotId: number;
  winnerBotId: number | null;
  reason: string;
  excitement: number;
  isRanked: boolean;
  createdAt: Date;
}

export interface ReplayRecord {
  matchId: number;
  meta: ReplayMeta;
  events: TickEvent[];
}

export interface Ranking {
  botId: number;
  modeId: string;
  score: number;
  wins: number;
  losses: number;
  draws: number;
}

export interface RankingDelta {
  score: number;
  wins?: number;
  losses?: number;
  draws?: number;
}

export interface Repository {
  createUser(displayName: string): Promise<User>;
  createBot(ownerId: number, name: string, modeId: string, botKeyHash: string): Promise<Bot>;
  getBotByKeyHash(hash: string): Promise<Bot | null>;
  getBot(id: number): Promise<Bot | null>;
  getLatestCode(botId: number): Promise<CodeVersion | null>;
  publishCode(botId: number, code: string, submittedBy: string, notes?: string): Promise<CodeVersion>;
  listMatches(botId: number, limit: number): Promise<Match[]>;
  createMatch(data: {
    modeId: string;
    seed: number;
    challengerBotId: number;
    defenderBotId: number;
    winnerBotId: number | null;
    reason: string;
    excitement: number;
    isRanked: boolean;
  }): Promise<Match>;
  getMatch(id: number): Promise<Match | null>;
  getReplay(matchId: number): Promise<ReplayRecord | null>;
  saveReplay(matchId: number, meta: ReplayMeta, events: TickEvent[]): Promise<void>;
  getRanking(botId: number, modeId: string): Promise<Ranking | null>;
  upsertRanking(botId: number, modeId: string, delta: RankingDelta): Promise<Ranking>;
  listRankings(modeId: string, limit: number): Promise<Ranking[]>;
  listBotsByMode(modeId: string): Promise<Bot[]>;
  searchOpponents(modeId: string, query: string): Promise<Bot[]>;
}

export class InMemoryRepository implements Repository {
  private users: User[] = [];
  private bots: Bot[] = [];
  private codeVersions: CodeVersion[] = [];
  private matches: Match[] = [];
  private replays = new Map<number, ReplayRecord>();
  private rankings = new Map<string, Ranking>(); // key: `${botId}:${modeId}`

  private nextUserId = 1;
  private nextBotId = 1;
  private nextCodeId = 1;
  private nextMatchId = 1;

  async createUser(displayName: string): Promise<User> {
    const user: User = {
      id: this.nextUserId++,
      displayName,
      createdAt: new Date(),
    };
    this.users.push(user);
    return user;
  }

  async createBot(ownerId: number, name: string, modeId: string, botKeyHash: string): Promise<Bot> {
    const bot: Bot = {
      id: this.nextBotId++,
      ownerId,
      name,
      modeId,
      botKeyHash,
      isPublic: true,
      createdAt: new Date(),
    };
    this.bots.push(bot);
    return bot;
  }

  async getBotByKeyHash(hash: string): Promise<Bot | null> {
    return this.bots.find(b => b.botKeyHash === hash) || null;
  }

  async getBot(id: number): Promise<Bot | null> {
    return this.bots.find(b => b.id === id) || null;
  }

  async getLatestCode(botId: number): Promise<CodeVersion | null> {
    const versions = this.codeVersions
      .filter(v => v.botId === botId)
      .sort((a, b) => b.version - a.version);
    return versions[0] || null;
  }

  async publishCode(botId: number, code: string, submittedBy: string, notes?: string): Promise<CodeVersion> {
    const existing = this.codeVersions.filter(v => v.botId === botId);
    const nextVersion = existing.length === 0 ? 1 : Math.max(...existing.map(v => v.version)) + 1;
    const cv: CodeVersion = {
      id: this.nextCodeId++,
      botId,
      version: nextVersion,
      code,
      submittedBy,
      notes: notes || null,
      createdAt: new Date(),
    };
    this.codeVersions.push(cv);
    return cv;
  }

  async listMatches(botId: number, limit: number): Promise<Match[]> {
    return this.matches
      .filter(m => m.challengerBotId === botId || m.defenderBotId === botId)
      .sort((a, b) => b.id - a.id)
      .slice(0, limit);
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
    const match: Match = {
      id: this.nextMatchId++,
      ...data,
      createdAt: new Date(),
    };
    this.matches.push(match);
    return match;
  }

  async getMatch(id: number): Promise<Match | null> {
    return this.matches.find(m => m.id === id) || null;
  }

  async getReplay(matchId: number): Promise<ReplayRecord | null> {
    return this.replays.get(matchId) || null;
  }

  async saveReplay(matchId: number, meta: ReplayMeta, events: TickEvent[]): Promise<void> {
    this.replays.set(matchId, { matchId, meta, events });
  }

  async getRanking(botId: number, modeId: string): Promise<Ranking | null> {
    return this.rankings.get(`${botId}:${modeId}`) || null;
  }

  async upsertRanking(botId: number, modeId: string, delta: RankingDelta): Promise<Ranking> {
    const key = `${botId}:${modeId}`;
    const existing = this.rankings.get(key);
    const updated: Ranking = existing
      ? {
          ...existing,
          score: existing.score + delta.score,
          wins: existing.wins + (delta.wins || 0),
          losses: existing.losses + (delta.losses || 0),
          draws: existing.draws + (delta.draws || 0),
        }
      : {
          botId,
          modeId,
          score: 1000 + delta.score,
          wins: delta.wins || 0,
          losses: delta.losses || 0,
          draws: delta.draws || 0,
        };
    this.rankings.set(key, updated);
    return updated;
  }

  async listRankings(modeId: string, limit: number): Promise<Ranking[]> {
    return Array.from(this.rankings.values())
      .filter(r => r.modeId === modeId)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  async listBotsByMode(modeId: string): Promise<Bot[]> {
    return this.bots.filter(b => b.modeId === modeId && b.isPublic);
  }

  async searchOpponents(modeId: string, query: string): Promise<Bot[]> {
    const q = query.toLowerCase();
    return this.bots.filter(
      b => b.modeId === modeId && b.isPublic && b.name.toLowerCase().includes(q),
    );
  }
}