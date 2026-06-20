import type { TickEvent, MatchResult, ReplayMeta } from '@yxpt/shared-types';

export interface RegisterResponse {
  userId: number;
  displayName: string;
  botId: number;
  botKey: string;
  modeId: string;
}

export interface Ranking {
  botId: number;
  modeId: string;
  score: number;
  wins: number;
  losses: number;
  draws: number;
  botName?: string;
}

export interface BotContext {
  id: number;
  name: string;
  modeId: string;
  ownerId: number | null;
  isPublic: boolean;
  createdAt: string;
  rank: Ranking;
  latestCodeVersion: number | null;
}

export interface PublishCodeResponse {
  version: number;
  createdAt: string;
}

export interface SimulateReplayPayload {
  meta: ReplayMeta;
  result: MatchResult;
  events: TickEvent[];
}

export interface SimulateResponse {
  modeId: string;
  seed: number;
  result: MatchResult;
  eventsCount: number;
  replay: SimulateReplayPayload;
  opponent: string;
}

export interface ChallengeResponse {
  matchId: number;
  modeId: string;
  seed: number;
  opponent: { id: number; name: string };
  result: MatchResult;
  replayUrl: string;
}

export interface MatchSummary {
  id: number;
  modeId: string;
  seed: number;
  challengerBotId: number;
  defenderBotId: number;
  winnerBotId: number | null;
  reason: string;
  excitement: number;
  isRanked: boolean;
  createdAt: string;
}

export interface ListMatchesResponse {
  matches: MatchSummary[];
}

export interface LeaderboardResponse {
  mode: string;
  period: string;
  rankings: Array<Ranking & { botName?: string }>;
}

export interface ReplayResponse {
  meta: ReplayMeta;
  result: MatchResult;
  events: TickEvent[];
  match: MatchSummary;
}

export interface BotKeyRecord {
  botId: number;
  botKey: string;
  displayName: string;
  mode: string;
}