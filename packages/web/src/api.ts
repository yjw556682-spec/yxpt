import type {
  RegisterResponse,
  BotContext,
  PublishCodeResponse,
  SimulateResponse,
  ChallengeResponse,
  ListMatchesResponse,
  LeaderboardResponse,
  ReplayResponse,
} from './types';

export class ApiError extends Error {
  status: number;
  body: unknown;
  constructor(message: string, status: number, body: unknown) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

async function request<T>(
  path: string,
  init: RequestInit & { token?: string | null } = {},
): Promise<T> {
  const { token, headers, ...rest } = init;
  const finalHeaders: Record<string, string> = {
    'content-type': 'application/json',
    ...((headers as Record<string, string>) || {}),
  };
  if (token) finalHeaders.authorization = `Bearer ${token}`;

  const res = await fetch(path, { ...rest, headers: finalHeaders });
  const text = await res.text();
  let body: unknown = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }
  if (!res.ok) {
    const msg = (body && typeof body === 'object' && 'error' in body)
      ? String((body as { error: unknown }).error)
      : `HTTP ${res.status}`;
    throw new ApiError(msg, res.status, body);
  }
  return body as T;
}

export const api = {
  registerUser(displayName: string): Promise<RegisterResponse> {
    return request<RegisterResponse>('/api/agent/users', {
      method: 'POST',
      body: JSON.stringify({ displayName }),
    });
  },

  getBot(token: string): Promise<BotContext> {
    return request<BotContext>('/api/agent/bot', { method: 'GET', token });
  },

  publishCode(
    token: string,
    code: string,
    submittedBy: string,
    notes?: string,
  ): Promise<PublishCodeResponse> {
    return request<PublishCodeResponse>('/api/agent/bot/code', {
      method: 'POST',
      token,
      body: JSON.stringify({ code, submittedBy, notes }),
    });
  },

  simulate(token: string, seed = 42, code?: string): Promise<SimulateResponse> {
    return request<SimulateResponse>('/api/agent/bot/simulate', {
      method: 'POST',
      token,
      body: JSON.stringify({ seed, code }),
    });
  },

  challengeRandom(token: string, seed?: number): Promise<ChallengeResponse> {
    return request<ChallengeResponse>('/api/agent/bot/challenge', {
      method: 'POST',
      token,
      body: JSON.stringify({ randomOpponent: true, seed }),
    });
  },

  listMatches(token: string, limit = 10): Promise<ListMatchesResponse> {
    return request<ListMatchesResponse>(`/api/agent/bot/matches?limit=${limit}`, {
      method: 'GET',
      token,
    });
  },

  leaderboard(mode: string, period?: string): Promise<LeaderboardResponse> {
    const qs = period ? `&period=${encodeURIComponent(period)}` : '';
    return request<LeaderboardResponse>(`/api/agent/leaderboard?mode=${encodeURIComponent(mode)}${qs}`);
  },

  replay(matchId: number): Promise<ReplayResponse> {
    return request<ReplayResponse>(`/api/matches/${matchId}/agent.json`);
  },
};