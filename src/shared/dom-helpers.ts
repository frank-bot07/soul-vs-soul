/**
 * Safe DOM helpers — no innerHTML anywhere.
 * These are stubs for server-side; full implementation used in browser.
 */

export interface VNode {
  tag: string;
  attrs: Record<string, string>;
  children: (string | VNode)[];
}

/**
 * Create a virtual DOM node. Safe by construction — strings become text nodes.
 */
export function h(tag: string, attrs: Record<string, string>, ...children: (string | VNode)[]): VNode {
  return { tag, attrs, children };
}

/**
 * Render a VNode tree to an HTML string with proper escaping.
 * All text content is escaped to prevent XSS.
 */
export function render(node: VNode): string {
  const attrStr = Object.entries(node.attrs)
    .map(([k, v]) => ` ${escapeAttr(k)}="${escapeAttr(v)}"`)
    .join('');

  const childStr = node.children
    .map((c) => (typeof c === 'string' ? escapeHtml(c) : render(c)))
    .join('');

  const voidElements = new Set([
    'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
    'link', 'meta', 'param', 'source', 'track', 'wbr',
  ]);

  if (voidElements.has(node.tag)) {
    return `<${node.tag}${attrStr} />`;
  }

  return `<${node.tag}${attrStr}>${childStr}</${node.tag}>`;
}

/** Escape HTML special characters in text content */
export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

/** Escape attribute values */
function escapeAttr(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}
