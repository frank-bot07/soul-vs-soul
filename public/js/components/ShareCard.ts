/** Share card for X */
import { h, render } from '../dom.js';

export function ShareCard(container: HTMLElement, winnerName: string, score: number, gameId: string): void {
  const gameUrl = `${location.origin}/#/game/${encodeURIComponent(gameId)}`;
  const tweetText = `🏆 ${winnerName} won Soul vs Soul with ${score} points! Watch the replay: ${gameUrl} #SoulVsSoul`;
  const tweetUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetText)}`;

  const shareBtn = h('a', {
    class: 'btn-share',
    href: tweetUrl,
    target: '_blank',
    rel: 'noopener noreferrer',
    'aria-label': 'Share results on X',
  }, '🐦 Share to X');

  const card = h('section', { class: 'share-card' },
    h('h3', {}, 'Share Your Results'),
    h('p', { class: 'share-text' }, `${winnerName} dominated with ${score} points!`),
    shareBtn,
  );

  render(container, card);
}
