/** Live game spectating view */
import { h, render } from '../dom.js';
import { store } from '../state.js';
import { GameSocket } from '../ws.js';
import type { PublicGameState } from '../ws.js';
import { Scoreboard } from './Scoreboard.js';
import { ChallengeView } from './ChallengeView.js';
import { ShareCard } from './ShareCard.js';
import { sanitizeDisplay } from '../lib/sanitize.js';

export function GameArena(container: HTMLElement, gameId: string): void {
  const socket = new GameSocket();
  let currentState: PublicGameState | null = null;
  let gameEnded = false;
  let _winnerName = '';
  let _winnerScore = 0;

  const arenaEl = h('div', { class: 'game-layout' });
  const mainCol = h('div', { class: 'game-arena' });
  const sideCol = h('div', {});
  arenaEl.append(mainCol, sideCol);
  render(container, arenaEl);

  // Scoreboard in sidebar
  Scoreboard(sideCol);

  socket.onFullState = (state) => {
    currentState = state;
    store.update({ gameState: state, agents: state.agents });
    renderArena();
  };

  socket.onRoundStart = (data) => {
    if (currentState) {
      currentState.round = data.round;
      store.update({ gameState: { ...currentState } });
    }
    renderArena();
  };

  socket.onChallenge = (data) => {
    if (currentState) {
      currentState.currentChallenge = {
        type: data.challenge.type,
        description: data.challenge.publicDescription,
        responses: [],
      };
      store.update({ gameState: { ...currentState } });
    }
    renderArena();
  };

  socket.onResponse = (data) => {
    if (currentState?.currentChallenge) {
      if (!currentState.currentChallenge.responses) {
        currentState.currentChallenge.responses = [];
      }
      currentState.currentChallenge.responses.push({
        agentDisplayId: data.agentId,
        response: sanitizeDisplay(data.response),
        score: data.score,
      });
      // Update agent score
      const agent = currentState.agents.find(a => a.displayId === data.agentId);
      if (agent) agent.score += data.score;
      store.update({ gameState: { ...currentState } });
    }
    renderArena();
  };

  socket.onElimination = (data) => {
    if (currentState) {
      const agent = currentState.agents.find(a => a.displayId === data.agentId);
      if (agent) agent.eliminated = true;
      store.update({ gameState: { ...currentState } });
    }
    renderArena();
  };

  socket.onGameEnd = (data) => {
    gameEnded = true;
    _winnerName = data.winner.name;
    _winnerScore = data.winner.score;
    renderArena();
  };

  socket.onConnectionChange = (connected) => {
    store.update({ connected });
    const statusEl = document.getElementById('connection-status');
    if (statusEl) {
      statusEl.textContent = connected ? '🟢 Live' : '🔴 Reconnecting…';
      statusEl.className = `connection-status ${connected ? 'connected' : 'disconnected'}`;
    }
  };

  socket.onError = (data) => {
    const errEl = h('p', { class: 'error', role: 'alert' }, `Error: ${data.message}`);
    mainCol.append(errEl);
  };

  socket.onDisconnected = (reason) => {
    const errEl = h('p', { class: 'error', role: 'alert' }, `Disconnected: ${reason}`);
    mainCol.append(errEl);
  };

  function renderArena(): void {
    const children: Node[] = [];

    if (gameEnded) {
      const endSection = h('section', { class: 'game-end' },
        h('h2', {}, '🏆 Game Over!'),
        h('p', { class: 'winner-name' }, _winnerName),
        h('p', {}, `Score: ${_winnerScore}`),
      );
      children.push(endSection);
      const shareContainer = h('div', {});
      children.push(shareContainer);
      render(mainCol, ...children);
      ShareCard(shareContainer, _winnerName, _winnerScore, gameId);
      return;
    }

    if (!currentState) {
      children.push(h('p', {}, 'Connecting to game…'));
      render(mainCol, ...children);
      return;
    }

    // Header
    const header = h('header', { class: 'arena-header' },
      h('span', { class: 'round-indicator' }, `Round ${currentState.round}`),
      h('span', { class: 'spectator-count', 'aria-label': 'Spectator count' }, `👁 ${currentState.spectatorCount}`),
    );
    children.push(header);

    // Challenge
    if (currentState.currentChallenge) {
      const challengeContainer = h('div', {});
      children.push(challengeContainer);
      render(mainCol, ...children);
      ChallengeView(challengeContainer, currentState.currentChallenge);
      return;
    }

    children.push(h('p', { class: 'waiting' }, 'Waiting for next challenge…'));
    render(mainCol, ...children);
  }

  // Start connection
  socket.connect(gameId);

  // Cleanup on navigation
  const cleanup = store.subscribe(() => {
    const state = store.getState();
    if (!state.route.includes(gameId)) {
      socket.disconnect();
      cleanup();
    }
  });
}
