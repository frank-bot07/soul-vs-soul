/** Active challenge display */
import { h, render } from '../dom.js';
import { sanitizeDisplay } from '../lib/sanitize.js';

interface ChallengeState {
  type: string;
  description: string;
  responses?: Array<{
    agentDisplayId: string;
    response: string;
    score: number;
  }>;
}

const TYPE_ICONS: Record<string, string> = {
  debate: '🗣️',
  strategy: '♟️',
  creative: '🎨',
  trivia: '📚',
};

export function ChallengeView(container: HTMLElement, challenge: ChallengeState): void {
  const children: Node[] = [];

  const display = h('article', { class: 'challenge-display' },
    h('div', { class: 'challenge-type' },
      `${TYPE_ICONS[challenge.type] ?? '❓'} ${challenge.type}`,
    ),
    h('p', { class: 'challenge-description' }, sanitizeDisplay(challenge.description)),
  );
  children.push(display);

  if (challenge.responses && challenge.responses.length > 0) {
    const responseList = h('div', { class: 'response-list', 'aria-label': 'Agent responses', role: 'list' });

    for (const resp of challenge.responses) {
      const card = h('article', { class: 'response-card', role: 'listitem' },
        h('div', { class: 'agent-name' }, resp.agentDisplayId),
        h('p', { class: 'response-text' }, sanitizeDisplay(resp.response)),
        h('div', { class: 'response-score' }, `Score: ${resp.score}`),
      );
      responseList.append(card);
    }
    children.push(responseList);
  }

  render(container, ...children);
}
