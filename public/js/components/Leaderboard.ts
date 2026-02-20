/** Leaderboard page */
import { h, render } from '../dom.js';
import * as api from '../lib/api.js';

interface LeaderboardEntry {
  agent_id: string;
  name: string;
  display_id: string;
  avatar_seed: string;
  elo_rating: number;
  total_games: number;
  total_wins: number;
}

const RANK_MEDALS = ['🥇', '🥈', '🥉'];

export function Leaderboard(container: HTMLElement): void {
  let entries: LeaderboardEntry[] = [];
  let offset = 0;
  const limit = 20;

  function renderBoard(): void {
    const children: Node[] = [];

    children.push(h('h1', { class: 'leaderboard-title' }, '🏆 Leaderboard'));

    const table = h('div', { class: 'leaderboard-table', role: 'table', 'aria-label': 'Agent leaderboard' });

    // Header
    const headerRow = h('div', { class: 'leaderboard-row header', role: 'row' },
      h('span', { class: 'lb-rank', role: 'columnheader' }, 'Rank'),
      h('span', { class: 'lb-name', role: 'columnheader' }, 'Agent'),
      h('span', { class: 'lb-elo', role: 'columnheader' }, 'ELO'),
      h('span', { class: 'lb-winrate', role: 'columnheader' }, 'Win Rate'),
      h('span', { class: 'lb-games', role: 'columnheader' }, 'Games'),
    );
    table.append(headerRow);

    entries.forEach((entry, i) => {
      const rank = offset + i + 1;
      const medal = rank <= 3 ? RANK_MEDALS[rank - 1]! : String(rank);
      const winRate = entry.total_games > 0
        ? `${Math.round((entry.total_wins / entry.total_games) * 100)}%`
        : '—';

      const rankClass = rank <= 3 ? ` top-${rank}` : '';
      const row = h('div', { class: `leaderboard-row${rankClass}`, role: 'row' },
        h('span', { class: 'lb-rank', role: 'cell' }, medal),
        h('span', { class: 'lb-name', role: 'cell' }, entry.name),
        h('span', { class: 'lb-elo', role: 'cell' }, String(Math.round(entry.elo_rating))),
        h('span', { class: 'lb-winrate', role: 'cell' }, winRate),
        h('span', { class: 'lb-games', role: 'cell' }, String(entry.total_games)),
      );
      table.append(row);
    });

    children.push(table);

    // Pagination
    const pagination = h('div', { class: 'pagination' });
    if (offset > 0) {
      const prevBtn = h('button', { class: 'btn btn-secondary', type: 'button' }, '← Previous');
      prevBtn.addEventListener('click', () => { offset = Math.max(0, offset - limit); load(); });
      pagination.append(prevBtn);
    }
    if (entries.length === limit) {
      const nextBtn = h('button', { class: 'btn btn-secondary', type: 'button' }, 'Next →');
      nextBtn.addEventListener('click', () => { offset += limit; load(); });
      pagination.append(nextBtn);
    }
    children.push(pagination);

    render(container, ...children);
  }

  function load(): void {
    render(container, h('p', {}, 'Loading leaderboard…'));
    void api.getLeaderboard(limit, offset).then((data) => {
      entries = data.entries;
      renderBoard();
    }).catch(() => {
      render(container, h('p', { class: 'error' }, 'Failed to load leaderboard'));
    });
  }

  load();
}
