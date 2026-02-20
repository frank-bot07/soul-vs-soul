/** CSS-only animated loading spinner */
import { h, render } from '../dom.js';

export function LoadingState(container: HTMLElement, message = 'Loading…'): void {
  const spinner = h('div', { class: 'loading-spinner', role: 'status', 'aria-label': message },
    h('div', { class: 'spinner-ring' }),
    h('p', { class: 'loading-text' }, message),
  );
  render(container, spinner);
}
