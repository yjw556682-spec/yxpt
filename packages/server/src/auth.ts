import { randomBytes, createHash } from 'node:crypto';

export function createBotKey(): string {
  return 'bk_' + randomBytes(16).toString('hex');
}

export function hashKey(key: string): string {
  return createHash('sha256').update(key).digest('hex');
}
