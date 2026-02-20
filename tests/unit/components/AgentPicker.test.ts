import { describe, it, expect, beforeEach } from 'vitest';
import { JSDOM } from 'jsdom';

// Minimal DOM test — we test the dom helpers and rendering logic
describe('AgentPicker rendering logic', () => {
  let document: Document;

  beforeEach(() => {
    const dom = new JSDOM('<!DOCTYPE html><html><body><div id="app"></div></body></html>');
    document = dom.window.document;
    // Patch global for dom.ts
    globalThis.document = document;
  });

  it('h() creates elements with text content (no innerHTML)', async () => {
    // Import dom helpers
    const { h } = await import('../../../public/js/dom.js');
    const el = h('div', { class: 'test' }, 'Hello <script>alert(1)</script>');
    expect(el.tagName).toBe('DIV');
    expect(el.className).toBe('test');
    // Text is safely set via createTextNode, not innerHTML
    expect(el.textContent).toBe('Hello <script>alert(1)</script>');
    // No HTML was parsed
    expect(el.children.length).toBe(0);
    expect(el.childNodes.length).toBe(1);
    expect(el.childNodes[0]!.nodeType).toBe(3); // TEXT_NODE
  });

  it('h() nests elements properly', async () => {
    const { h } = await import('../../../public/js/dom.js');
    const card = h('div', { class: 'card' },
      h('h3', {}, 'Title'),
      h('p', {}, 'Description'),
    );
    expect(card.children.length).toBe(2);
    expect(card.children[0]!.tagName).toBe('H3');
    expect(card.children[0]!.textContent).toBe('Title');
  });

  it('render() replaces container children', async () => {
    const { h, render } = await import('../../../public/js/dom.js');
    const container = document.getElementById('app')!;
    container.append(document.createTextNode('old content'));

    render(container, h('p', {}, 'new content'));
    expect(container.children.length).toBe(1);
    expect(container.textContent).toBe('new content');
  });

  it('escapeHtml escapes special chars', async () => {
    const { escapeHtml } = await import('../../../public/js/dom.js');
    expect(escapeHtml('<script>"hello"&\'world\'</script>')).toBe(
      '&lt;script&gt;&quot;hello&quot;&amp;&#x27;world&#x27;&lt;/script&gt;'
    );
  });
});
