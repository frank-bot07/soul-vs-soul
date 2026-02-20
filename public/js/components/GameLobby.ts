/** Game lobby — browse active and recent games */
import { h, render } from '../dom.js';
import * as api from '../lib/api.js';

interface GameEntry {
  id: string;
  status: string;
  mode: string;
  created_at: number;
}

export function GameLobby(container: HTMLElement): void {
  let games: GameEntry[] = [];
  let statusFilter = '';
  let offset = 0;
  const limit = 20;

  function renderLobby(): void {
    const children: Node[] = [];
    children.push(h('h1', {}, '🎮 Game Lobby'));

    // Filters
    const filters = h('div', { class: 'lobby-filters' });
    for (const [val, label] of [['', 'All'], ['running', '🟢 Live'], ['completed', '✅ Completed'], ['pending', '⏳ Pending']]) {
      const btn = h('button', {
        class: `btn btn-filter${statusFilter === val ? ' active' : ''}`,
        type: 'button',
      }, label!);
      btn.addEventListener('click', () => { statusFilter = val!; offset = 0; load(); });
      filters.append(btn);
    }
    children.push(filters);

    // Game list
    const list = h('div', { class: 'game-list', role: 'list' });
    for (const game of games) {
      const statusIcon = game.status === 'running' ? '🟢' : game.status === 'completed' ? '✅' : '⏳';
      const actionLabel = game.status === 'running' ? 'Watch Live' : game.status === 'completed' ? 'Watch Replay' : 'View';
      const actionRoute = game.status === 'completed' ? `#/replay/${game.id}` : `#/game/${game.id}`;

      const actionBtn = h('a', { class: 'btn btn-primary btn-sm', href: actionRoute }, actionLabel);

      const card = h('div', { class: 'game-card', role: 'listitem' },
        h('div', { class: 'game-info' },
          h('span', { class: 'game-status' }, `${statusIcon} ${game.status}`),
          h('span', { class: 'game-mode' }, game.mode),
          h('span', { class: 'game-date' }, new Date(game.created_at * 1000).toLocaleString()),
        ),
        actionBtn,
      );
      list.append(card);
    }

    if (games.length === 0) {
      list.append(h('p', { class: 'empty' }, 'No games found'));
    }

    children.push(list);

    // Pagination
    const pagination = h('div', { class: 'pagination' });
    if (offset > 0) {
      const prevBtn = h('button', { class: 'btn btn-secondary', type: 'button' }, '← Previous');
      prevBtn.addEventListener('click', () => { offset = Math.max(0, offset - limit); load(); });
      pagination.append(prevBtn);
    }
    if (games.length === limit) {
      const nextBtn = h('button', { class: 'btn btn-secondary', type: 'button' }, 'Next →');
      nextBtn.addEventListener('click', () => { offset += limit; load(); });
      pagination.append(nextBtn);
    }
    children.push(pagination);

    render(container, ...children);
  }

  function load(): void {
    render(container, h('p', {}, 'Loading games…'));
    void api.listGamesFiltered({ status: statusFilter || undefined, limit, offset }).then((data) => {
      games = data.games;
      renderLobby();
    }).catch(() => {
      render(container, h('p', { class: 'error' }, 'Failed to load games'));
    });
  }

  load();
}
