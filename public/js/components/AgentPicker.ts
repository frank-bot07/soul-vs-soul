/** "Choose Your Fighter" agent picker */
import { h, render } from '../dom.js';
import { store } from '../state.js';
import * as api from '../lib/api.js';

interface PresetAgent {
  id: string;
  name: string;
  emoji: string;
  description: string;
}

const PRESETS: PresetAgent[] = [
  { id: 'preset-philosopher', name: 'The Philosopher', emoji: '🧠', description: 'Deep thinker who questions everything' },
  { id: 'preset-comedian', name: 'The Comedian', emoji: '😂', description: 'Quick wit and sharp humor' },
  { id: 'preset-strategist', name: 'The Strategist', emoji: '♟️', description: 'Calculated moves, always planning' },
  { id: 'preset-rebel', name: 'The Rebel', emoji: '🔥', description: 'Breaks rules and challenges norms' },
  { id: 'preset-poet', name: 'The Poet', emoji: '✨', description: 'Beauty in every word' },
  { id: 'preset-scientist', name: 'The Scientist', emoji: '🔬', description: 'Evidence-based and analytical' },
  { id: 'preset-mystic', name: 'The Mystic', emoji: '🔮', description: 'Enigmatic and mysterious' },
  { id: 'preset-warrior', name: 'The Warrior', emoji: '⚔️', description: 'Bold, direct, fearless' },
];

export function AgentPicker(container: HTMLElement): void {
  const selected = new Set<string>();

  function renderPicker(): void {
    const header = h('header', { class: 'picker-header' },
      h('h1', {}, '⚔️ Choose Your Fighters'),
      h('p', {}, 'Select 2 or more agents to battle'),
    );

    const grid = h('div', { class: 'agent-grid', role: 'group', 'aria-label': 'Agent selection' });

    for (const agent of PRESETS) {
      const tile = h('button', {
        class: `agent-tile${selected.has(agent.id) ? ' selected' : ''}`,
        'aria-pressed': selected.has(agent.id) ? 'true' : 'false',
        'aria-label': `Select ${agent.name}`,
        'data-id': agent.id,
        type: 'button',
      },
        h('div', { class: 'emoji' }, agent.emoji),
        h('div', { class: 'name' }, agent.name),
        h('div', { class: 'desc' }, agent.description),
      );
      tile.addEventListener('click', () => toggleAgent(agent.id));
      grid.append(tile);
    }

    const startBtn = h('button', {
      class: 'btn btn-primary',
      type: 'button',
      ...(selected.size < 2 ? { disabled: '' } : {}),
      'aria-label': 'Start game',
    }, '🎮 Start Game');

    if (selected.size < 2) {
      startBtn.setAttribute('disabled', '');
    }
    startBtn.addEventListener('click', handleStart);

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
      // Create agents for presets, then create + start game
      const agentIds: string[] = [];
      for (const presetId of selected) {
        const preset = PRESETS.find(p => p.id === presetId);
        if (!preset) continue;
        const created = await api.createAgent(preset.name, `${preset.emoji} ${preset.description}. I am ${preset.name}.`);
        agentIds.push(created.id);
      }
      const game = await api.createGame(agentIds);
      await api.startGame(game.id);
      location.hash = `#/game/${game.id}`;
    } catch (err) {
      const errEl = h('p', { class: 'error', role: 'alert' }, `Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
      container.append(errEl);
    }
  }

  renderPicker();
}
