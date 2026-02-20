/** Client state management with pub/sub */

import type { PublicGameState, PublicAgent } from './ws.js';

export interface AppState {
  connected: boolean;
  gameState: PublicGameState | null;
  agents: PublicAgent[];
  selectedAgentIds: Set<string>;
  route: string;
}

type Listener = () => void;

class Store {
  private state: AppState = {
    connected: false,
    gameState: null,
    agents: [],
    selectedAgentIds: new Set(),
    route: location.hash || '#/',
  };

  private listeners: Set<Listener> = new Set();

  getState(): Readonly<AppState> {
    return this.state;
  }

  update(partial: Partial<AppState>): void {
    this.state = { ...this.state, ...partial };
    this.notify();
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    for (const listener of this.listeners) {
      listener();
    }
  }
}

export const store = new Store();
