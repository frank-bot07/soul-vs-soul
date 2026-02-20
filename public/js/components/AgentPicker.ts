/** "Choose Your Fighter" agent picker */
import { h, render } from '../dom.js';
import { store } from '../state.js';
import { LoadingState } from './LoadingState.js';
import { ErrorState } from './ErrorState.js';
import * as api from '../lib/api.js';

export function AgentPicker(container: HTMLElement): void {
  const selected = new Set<string>();
  let agents: api.AgentResponse[] = [];
  let loading = true;
  let error: string | null = null;

  function renderPicker(): void {
    if (loading) {
      LoadingState(container, 'Loading fighters…');
      return;
    }
    if (error) {
      ErrorState(container, error, () => void loadAgents());
      return;
    }

    const header = h('header', { class: 'picker-header' },
      h('h1', {}, '⚔️ Choose Your Fighters'),
      h('p', {}, 'Select 2 or more agents to battle'),
    );

    const grid = h('div', { class: 'agent-grid', role: 'group', 'aria-label': 'Agent selection' });

    for (const agent of agents) {
      const tile = h('button', {
        class: `agent-tile${selected.has(agent.id) ? ' selected' : ''}`,
        'aria-pressed': selected.has(agent.id) ? 'true' : 'false',
        'aria-label': `Select ${agent.name}`,
        'data-id': agent.id,
        type: 'button',
      },
        h('div', { class: 'emoji' }, '🤖'),
        h('div', { class: 'name' }, agent.name),
        h('div', { class: 'desc' }, agent.personality ?? ''),
      );
      tile.addEventListener('click', () => toggleAgent(agent.id));
      grid.append(tile);
    }

    const startBtn = h('button', {
      class: 'btn btn-primary',
      type: 'button',
      'aria-label': 'Start game',
    }, '🎮 Start Game');

    if (selected.size < 2) {
      startBtn.setAttribute('disabled', '');
    }
    startBtn.addEventListener('click', () => void handleStart());

    const actions = h('div', { class: 'picker-actions' }, startBtn);
    render(container, header, grid, actions);
  }

  function toggleAgent(id: string): void {
    if (selected.has(id)) {
      selected.delete(id);
    } else {
      selected.add(id);
    }
    store.update({ selectedAgentIds: new Set(selected) });
    renderPicker();
  }

  async function handleStart(): Promise<void> {
    if (selected.size < 2) return;
    try {
      LoadingState(container, 'Creating game…');
      const game = await api.createGame([...selected]);
      await api.startGame(game.id);
      location.hash = `#/game/${game.id}`;
    } catch (err) {
      ErrorState(container, err instanceof Error ? err.message : 'Failed to create game', () => renderPicker());
    }
  }

  async function loadAgents(): Promise<void> {
    loading = true;
    error = null;
    renderPicker();
    try {
      const resp = await api.listAgents();
      agents = Array.isArray(resp) ? resp : (resp as unknown as { agents: api.AgentResponse[] }).agents;
      loading = false;
    } catch (err) {
      loading = false;
      error = err instanceof Error ? err.message : 'Failed to load agents';
    }
    renderPicker();
  }

  void loadAgents();
}
