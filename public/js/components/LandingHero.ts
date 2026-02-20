/** Landing page hero section */
import { h, render } from '../dom.js';

export function LandingHero(container: HTMLElement, onStart: () => void): void {
  const logo = h('div', { class: 'hero-logo' },
    h('span', { class: 'logo-soul-left' }, 'SOUL'),
    h('span', { class: 'logo-vs' }, ' vs '),
    h('span', { class: 'logo-soul-right' }, 'SOUL'),
  );

  const tagline = h('p', { class: 'hero-tagline' }, 'Upload your soul. Fight to win.');

  const ctaBtn = h('button', {
    class: 'btn btn-cta',
    type: 'button',
    'aria-label': 'Choose your fighter',
  }, 'Choose Your Fighter →');
  ctaBtn.addEventListener('click', onStart);

  const preview = h('div', { class: 'hero-preview' },
    h('div', { class: 'preview-tile' },
      h('span', { class: 'preview-emoji' }, '🧠'),
      h('span', { class: 'preview-vs' }, 'vs'),
      h('span', { class: 'preview-emoji' }, '🔥'),
    ),
  );

  const hero = h('section', { class: 'landing-hero' },
    logo,
    tagline,
    ctaBtn,
    preview,
  );

  render(container, hero);
}
