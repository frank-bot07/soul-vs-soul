import { ReplayQueries, type ReplayEventRow } from '../db/queries/replays.js';

export class ReplayService {
  private sequences = new Map<string, number>();

  constructor(private replayQueries: ReplayQueries) {}

  record(gameId: string, eventType: string, data: unknown): void {
    const seq = (this.sequences.get(gameId) ?? 0) + 1;
    this.sequences.set(gameId, seq);
    this.replayQueries.insert(gameId, seq, eventType, JSON.stringify(data));
  }

  getReplay(gameId: string): ReplayEventRow[] {
    return this.replayQueries.getByGame(gameId);
  }

  getEventCount(gameId: string): number {
    return this.replayQueries.getCount(gameId);
  }

  cleanup(gameId: string): void {
    this.sequences.delete(gameId);
  }
}
