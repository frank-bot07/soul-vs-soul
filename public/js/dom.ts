/** Safe DOM helpers — NO innerHTML anywhere */

type Child = string | Node;
type Attrs = Record<string, string>;

/** Create an HTML element safely. Strings become text nodes (auto-escaped). */
export function h(tag: string, attrs: Attrs = {}, ...children: Child[]): HTMLElement {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k.startsWith('data-')) {
      el.setAttribute(k, v);
    } else if (k === 'class') {
      el.className = v;
    } else if (k === 'for') {
      el.setAttribute('for', v);
    } else {
      el.setAttribute(k, v);
    }
  }
  for (const child of children) {
    el.append(typeof child === 'string' ? document.createTextNode(child) : child);
  }
  return el;
}

/** Mount a component into a container, replacing existing content safely */
export function render(container: HTMLElement, ...children: Node[]): void {
  container.replaceChildren(...children);
}

/** Escape HTML special characters */
export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}
