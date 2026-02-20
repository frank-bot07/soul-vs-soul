/** Share card for X */
import { h, render } from '../dom.js';

export function ShareCard(container: HTMLElement, winnerName: string, score: number, gameId: string): void {
  const siteUrl = 'https://soulvssoul.com';
  const gameUrl = `${siteUrl}/game/${encodeURIComponent(gameId)}`;
  const tweetText = `🏆 ${winnerName} just dominated in Soul vs Soul! ${score} points | Watch the next battle →`;
  const shareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetText)}&url=${encodeURIComponent(gameUrl)}`;

  const xLogo = h('span', { class: 'x-logo', 'aria-hidden': 'true' }, '𝕏');

  const shareBtn = h('a', {
    class: 'btn btn-share',
    href: shareUrl,
    target: '_blank',
    rel: 'noopener noreferrer',
    'aria-label': 'Share results on X',
  }, xLogo, ' Share to X');

  const copyBtn = h('button', {
    class: 'btn btn-secondary',
    type: 'button',
    'aria-label': 'Copy game link',
  }, '🔗 Copy Link');

  copyBtn.addEventListener('click', () => {
    const localGameUrl = `${location.origin}/#/game/${encodeURIComponent(gameId)}`;
    void navigator.clipboard.writeText(localGameUrl).then(() => {
      copyBtn.textContent = '✅ Copied!';
      setTimeout(() => { copyBtn.textContent = '🔗 Copy Link'; }, 2000);
    });
  });

  const card = h('section', { class: 'share-card' },
    h('h3', {}, 'Share Your Victory'),
    h('p', { class: 'share-text' }, `${winnerName} dominated with ${score} points!`),
    h('div', { class: 'share-actions' }, shareBtn, copyBtn),
  );

  render(container, card);
}
