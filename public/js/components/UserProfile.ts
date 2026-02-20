/** User profile page */
import { h, render } from '../dom.js';
import * as api from '../lib/api.js';

export function UserProfile(container: HTMLElement, userId: string): void {
  render(container, h('p', {}, 'Loading profile…'));

  void api.getUserProfile(userId).then((profile) => {
    const children: Node[] = [];

    children.push(h('h1', {}, profile.displayName));
    children.push(h('p', { class: 'profile-joined' }, `Joined: ${new Date(profile.joinedAt * 1000).toLocaleDateString()}`));

    // Stats
    const stats = h('div', { class: 'profile-stats' },
      h('div', { class: 'stat' },
        h('span', { class: 'stat-value' }, String(profile.stats.totalGames)),
        h('span', { class: 'stat-label' }, 'Games'),
      ),
      h('div', { class: 'stat' },
        h('span', { class: 'stat-value' }, String(profile.stats.wins)),
        h('span', { class: 'stat-label' }, 'Wins'),
      ),
      h('div', { class: 'stat' },
        h('span', { class: 'stat-value' }, `${profile.stats.winRate}%`),
        h('span', { class: 'stat-label' }, 'Win Rate'),
      ),
    );
    children.push(stats);

    // Agents
    if (profile.agents.length > 0) {
      children.push(h('h2', {}, 'Agents'));
      const agentList = h('div', { class: 'agent-grid' });
      for (const agent of profile.agents) {
        agentList.append(
          h('div', { class: 'agent-card' },
            h('span', { class: 'agent-name' }, agent.name),
            h('span', { class: 'agent-stats' }, `${agent.play_count} games, ${agent.win_count} wins`),
          ),
        );
      }
      children.push(agentList);
    }

    // Recent games
    if (profile.recentGames.length > 0) {
      children.push(h('h2', {}, 'Recent Games'));
      const gameList = h('div', { class: 'game-history', role: 'list' });
      for (const game of profile.recentGames) {
        const placement = game.placement ? `#${game.placement}` : '—';
        gameList.append(
          h('div', { class: 'game-history-item', role: 'listitem' },
            h('span', {}, `Game ${game.game_id.slice(0, 8)}`),
            h('span', {}, `Placement: ${placement}`),
            h('span', {}, game.status),
          ),
        );
      }
      children.push(gameList);
    }

    render(container, ...children);
  }).catch(() => {
    render(container, h('p', { class: 'error' }, 'Failed to load profile'));
  });
}
