/** Persistent scoreboard */
import { h, render } from '../dom.js';
import { store } from '../state.js';

export function Scoreboard(container: HTMLElement): void {
  let collapsed = false;

  function renderBoard(): void {
    const state = store.getState();
    const agents = state.gameState?.agents ?? [];
    const sorted = [...agents].sort((a, b) => b.score - a.score);

    const board = h('aside', { class: `scoreboard${collapsed ? ' collapsed' : ''}`, 'aria-label': 'Scoreboard' });

    const toggleBtn = h('button', {
      class: 'scoreboard-toggle',
      type: 'button',
      'aria-label': collapsed ? 'Expand scoreboard' : 'Collapse scoreboard',
    }, collapsed ? '▶' : '▼');
    toggleBtn.addEventListener('click', () => {
      collapsed = !collapsed;
      renderBoard();
    });

    const header = h('div', { class: 'scoreboard-header' },
      h('h2', {}, '🏆 Scores'),
      toggleBtn,
    );
    board.append(header);

    const list = h('div', { class: 'scoreboard-list', role: 'list' });

    sorted.forEach((agent, i) => {
      const entry = h('div', {
        class: `scoreboard-entry${agent.eliminated ? ' eliminated' : ''}`,
        role: 'listitem',
        'aria-label': `${agent.name}: ${agent.score} points${agent.eliminated ? ', eliminated' : ''}`,
      },
        h('span', { class: 'rank' }, `${i + 1}.`),
        h('span', { class: 'agent-emoji' }, agent.avatar ?? '🤖'),
        h('span', { class: 'agent-info' },
          h('span', { class: 'agent-name' }, agent.name),
        ),
        h('span', { class: 'score' }, String(agent.score)),
      );
      list.append(entry);
    });

    board.append(list);
    render(container, board);
  }

  store.subscribe(renderBoard);
  renderBoard();
}
