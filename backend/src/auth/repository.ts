import type { PlayerProgress, User } from '@game/contracts.js';

export interface Credentials extends User {
  passwordHash: string;
}

export interface SessionInput {
  tokenHash: string;
  expiresAt: Date;
}

export class EmailAlreadyUsedError extends Error {}

export interface AuthRepository {
  register(email: string, passwordHash: string, session: SessionInput): Promise<User>;
  findCredentials(email: string): Promise<Credentials | null>;
  createSession(userId: string, session: SessionInput): Promise<void>;
  findSession(tokenHash: string): Promise<User | null>;
  deleteSession(tokenHash: string): Promise<void>;
  getProgress(userId: string): Promise<PlayerProgress | null>;
  updateName(userId: string, name: string): Promise<User>;
}
