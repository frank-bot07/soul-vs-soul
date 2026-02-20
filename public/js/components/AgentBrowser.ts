/** Agent browser with search, sort, filter */
import { h, render } from '../dom.js';
import * as api from '../lib/api.js';
import type { AgentResponse } from '../lib/api.js';

export function AgentBrowser(container: HTMLElement): void {
  let agents: AgentResponse[] = [];
  let search = '';
  let sort = 'newest';
  let presetFilter: string | undefined;
  let offset = 0;
  const limit = 20;

  function renderBrowser(): void {
    const children: Node[] = [];
    children.push(h('h1', {}, '🤖 Browse Agents'));

    // Search + filters
    const controls = h('div', { class: 'agent-browser-controls' });

    const searchInput = h('input', {
      type: 'text',
      class: 'search-input',
      placeholder: 'Search agents…',
      'aria-label': 'Search agents',
    }) as HTMLInputElement;
    searchInput.value = search;
    searchInput.addEventListener('input', () => { search = searchInput.value; offset = 0; load(); });

    const sortSelect = h('select', { class: 'sort-select', 'aria-label': 'Sort agents' }) as HTMLSelectElement;
    for (const [val, label] of [['newest', 'Newest'], ['popular', 'Most Popular'], ['winrate', 'Best Win Rate']]) {
      const opt = h('option', { value: val! }, label!);
      if (val === sort) (opt as HTMLOptionElement).selected = true;
      sortSelect.append(opt);
    }
    sortSelect.addEventListener('change', () => { sort = sortSelect.value; offset = 0; load(); });

    const presetToggle = h('button', {
      class: `btn btn-filter${presetFilter === 'true' ? ' active' : ''}`,
      type: 'button',
    }, 'Presets Only');
    presetToggle.addEventListener('click', () => {
      presetFilter = presetFilter === 'true' ? undefined : 'true';
      offset = 0;
      load();
    });

    controls.append(searchInput, sortSelect, presetToggle);
    children.push(controls);

    // Agent cards
    const grid = h('div', { class: 'agent-grid' });
    for (const agent of agents) {
      const winRate = agent.playCount && agent.playCount > 0
        ? `${Math.round(((agent.winCount ?? 0) / agent.playCount) * 100)}%`
        : '—';
      const card = h('div', { class: 'agent-card' },
        h('h3', { class: 'agent-name' }, agent.name),
        h('div', { class: 'agent-meta' },
          h('span', {}, `${agent.playCount ?? 0} games`),
          h('span', {}, `Win rate: ${winRate}`),
        ),
      );
      grid.append(card);
    }
    children.push(grid);

    // Pagination
    const pagination = h('div', { class: 'pagination' });
    if (offset > 0) {
      const prevBtn = h('button', { class: 'btn btn-secondary', type: 'button' }, '← Previous');
      prevBtn.addEventListener('click', () => { offset = Math.max(0, offset - limit); load(); });
      pagination.append(prevBtn);
    }
    if (agents.length === limit) {
      const nextBtn = h('button', { class: 'btn btn-secondary', type: 'button' }, 'Next →');
      nextBtn.addEventListener('click', () => { offset += limit; load(); });
      pagination.append(nextBtn);
    }
    children.push(pagination);

    render(container, ...children);
  }

  function load(): void {
    void api.searchAgents({ search, sort, preset: presetFilter, limit, offset }).then((data) => {
      agents = data.agents;
      renderBrowser();
    }).catch(() => {
      render(container, h('p', { class: 'error' }, 'Failed to load agents'));
    });
  }

  load();
}
