/** Replay player — streams game events with timing controls */
import { h, render } from '../dom.js';
import { store } from '../state.js';
import * as api from '../lib/api.js';
import { Scoreboard } from './Scoreboard.js';
import type { PublicGameState } from '../ws.js';

interface ReplayEvent {
  sequence: number;
  eventType: string;
  data: Record<string, unknown>;
  timestamp: number;
}

export function ReplayPlayer(container: HTMLElement, gameId: string): void {
  let events: ReplayEvent[] = [];
  let currentIndex = 0;
  let playing = false;
  let speed = 1;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const layout = h('div', { class: 'game-layout' });
  const mainCol = h('div', { class: 'replay-arena' });
  const sideCol = h('div', {});
  layout.append(mainCol, sideCol);
  render(container, layout);

  Scoreboard(sideCol);

  const gameState: PublicGameState = {
    gameId,
    round: 0,
    agents: [],
    currentChallenge: null,
    spectatorCount: 0,
  };

  function updateUI(): void {
    const children: Node[] = [];

    // Controls
    const controls = h('div', { class: 'replay-controls' });

    const playBtn = h('button', { class: 'btn btn-primary', type: 'button' }, playing ? '⏸ Pause' : '▶ Play');
    playBtn.addEventListener('click', () => {
      if (playing) pause(); else play();
    });

    const speedBtns = [1, 2, 5].map((s) => {
      const btn = h('button', {
        class: `btn btn-speed${speed === s ? ' active' : ''}`,
        type: 'button',
      }, `${s}x`);
      btn.addEventListener('click', () => { speed = s; updateUI(); });
      return btn;
    });

    const restartBtn = h('button', { class: 'btn btn-secondary', type: 'button' }, '⏮ Restart');
    restartBtn.addEventListener('click', () => {
      pause();
      currentIndex = 0;
      resetState();
      updateUI();
    });

    controls.append(playBtn, ...speedBtns, restartBtn);
    children.push(controls);

    // Scrubber
    const progress = currentIndex / Math.max(events.length - 1, 1);
    const scrubberTrack = h('div', { class: 'scrubber-track' });
    const scrubberFill = h('div', { class: 'scrubber-fill' });
    scrubberFill.style.width = `${progress * 100}%`;
    scrubberTrack.append(scrubberFill);
    scrubberTrack.addEventListener('click', (e: MouseEvent) => {
      const rect = scrubberTrack.getBoundingClientRect();
      const pct = (e.clientX - rect.left) / rect.width;
      currentIndex = Math.floor(pct * events.length);
      replayUpTo(currentIndex);
      updateUI();
    });
    children.push(scrubberTrack);

    // Event info
    children.push(h('p', { class: 'replay-info' },
      `Event ${currentIndex + 1} / ${events.length} | Round ${gameState.round} | Speed: ${speed}x`,
    ));

    // Current event display
    if (currentIndex < events.length) {
      const evt = events[currentIndex]!;
      const eventDisplay = h('div', { class: 'replay-event' },
        h('span', { class: 'event-type' }, evt.eventType),
      );

      if (evt.eventType === 'agent:response') {
        const data = evt.data as { agentId?: string; response?: string; score?: number };
        eventDisplay.append(
          h('p', { class: 'agent-name' }, String(data.agentId ?? '')),
          h('p', { class: 'response-text' }, String(data.response ?? '').slice(0, 300)),
          h('p', { class: 'response-score' }, `Score: ${data.score ?? 0}`),
        );
      }

      if (evt.eventType === 'game:end') {
        const data = evt.data as { winner?: { name?: string; score?: number } };
        eventDisplay.append(
          h('h2', {}, '🏆 Game Over!'),
          h('p', { class: 'winner-name' }, String(data.winner?.name ?? 'Unknown')),
        );
      }

      children.push(eventDisplay);
    }

    // Share
    const shareBtn = h('button', { class: 'btn btn-secondary', type: 'button' }, '🔗 Copy Replay Link');
    shareBtn.addEventListener('click', () => {
      const url = `${location.origin}/#/replay/${encodeURIComponent(gameId)}`;
      void navigator.clipboard.writeText(url).then(() => {
        shareBtn.textContent = '✅ Copied!';
        setTimeout(() => { shareBtn.textContent = '🔗 Copy Replay Link'; }, 2000);
      });
    });
    children.push(shareBtn);

    render(mainCol, ...children);
  }

  function resetState(): void {
    gameState.round = 0;
    gameState.agents = [];
    gameState.currentChallenge = null;
    store.update({ gameState: { ...gameState } });
  }

  function applyEvent(evt: ReplayEvent): void {
    const data = evt.data;
    switch (evt.eventType) {
      case 'game:start': {
        const d = data as { agents?: Array<{ displayId: string; name: string; avatarSeed?: string; score: number; eliminated: boolean }> };
        gameState.agents = (d.agents ?? []).map((a) => ({ ...a, avatarSeed: a.avatarSeed ?? '' }));
        break;
      }
      case 'round:start':
        gameState.round = (data as { round?: number }).round ?? gameState.round + 1;
        gameState.currentChallenge = null;
        break;
      case 'challenge:start': {
        const ch = (data as { challenge?: { type?: string; publicDescription?: string } }).challenge;
        gameState.currentChallenge = {
          type: ch?.type ?? 'unknown',
          description: ch?.publicDescription ?? '',
          responses: [],
        };
        break;
      }
      case 'agent:response': {
        const r = data as { agentId?: string; response?: string; score?: number };
        if (gameState.currentChallenge) {
          if (!gameState.currentChallenge.responses) gameState.currentChallenge.responses = [];
          gameState.currentChallenge.responses.push({
            agentDisplayId: String(r.agentId ?? ''),
            response: String(r.response ?? ''),
            score: Number(r.score ?? 0),
          });
        }
        const agent = gameState.agents.find((a) => a.displayId === r.agentId);
        if (agent) agent.score += Number(r.score ?? 0);
        break;
      }
      case 'elimination': {
        const e = data as { agentId?: string };
        const agent = gameState.agents.find((a) => a.displayId === e.agentId);
        if (agent) agent.eliminated = true;
        break;
      }
    }
    store.update({ gameState: { ...gameState } });
  }

  function replayUpTo(index: number): void {
    resetState();
    for (let i = 0; i <= Math.min(index, events.length - 1); i++) {
      applyEvent(events[i]!);
    }
  }

  function play(): void {
    playing = true;
    updateUI();
    scheduleNext();
  }

  function pause(): void {
    playing = false;
    if (timer) { clearTimeout(timer); timer = null; }
    updateUI();
  }

  function scheduleNext(): void {
    if (!playing || currentIndex >= events.length - 1) {
      playing = false;
      updateUI();
      return;
    }
    const delay = Math.max(200 / speed, 50);
    timer = setTimeout(() => {
      currentIndex++;
      applyEvent(events[currentIndex]!);
      updateUI();
      scheduleNext();
    }, delay);
  }

  // Load replay data
  void api.getReplay(gameId).then((replay) => {
    events = replay.events;
    if (events.length > 0) {
      applyEvent(events[0]!);
    }
    updateUI();
  }).catch(() => {
    render(mainCol, h('p', { class: 'error' }, 'Failed to load replay'));
  });
}
