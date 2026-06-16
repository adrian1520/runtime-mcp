import type { SessionState } from './types';

export interface SessionManager {
  get(sessionId: string): Promise<SessionState | null>;
  save(state: SessionState): Promise<void>;
  delete(sessionId: string): Promise<void>;
}
