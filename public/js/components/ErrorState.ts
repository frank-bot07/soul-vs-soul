/** Friendly error message with retry button */
import { h, render } from '../dom.js';

export function ErrorState(
  container: HTMLElement,
  message: string,
  onRetry?: () => void,
): void {
  const children: Node[] = [
    h('div', { class: 'error-icon' }, '⚠️'),
    h('h2', { class: 'error-title' }, 'Something went wrong'),
    h('p', { class: 'error-message', role: 'alert' }, message),
  ];

  if (onRetry) {
    const retryBtn = h('button', {
      class: 'btn btn-primary',
      type: 'button',
      'aria-label': 'Retry',
    }, '🔄 Try Again');
    retryBtn.addEventListener('click', onRetry);
    children.push(retryBtn);
  }

  const errorEl = h('section', { class: 'error-state' }, ...children);
  render(container, errorEl);
}
