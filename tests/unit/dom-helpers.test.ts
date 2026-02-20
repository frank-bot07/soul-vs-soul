import { describe, it, expect } from 'vitest';
import { h, render, escapeHtml } from '../../src/shared/dom-helpers.js';

describe('DOM helpers', () => {
  describe('h()', () => {
    it('creates a VNode', () => {
      const node = h('div', { class: 'test' }, 'hello');
      expect(node.tag).toBe('div');
      expect(node.attrs).toEqual({ class: 'test' });
      expect(node.children).toEqual(['hello']);
    });

    it('supports nested nodes', () => {
      const node = h('div', {}, h('span', {}, 'child'));
      expect(node.children).toHaveLength(1);
      expect((node.children[0] as ReturnType<typeof h>).tag).toBe('span');
    });
  });

  describe('render()', () => {
    it('renders simple element', () => {
      expect(render(h('p', {}, 'text'))).toBe('<p>text</p>');
    });

    it('escapes text content', () => {
      expect(render(h('p', {}, '<script>alert("xss")</script>'))).toBe(
        '<p>&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;</p>',
      );
    });

    it('renders attributes', () => {
      expect(render(h('a', { href: '/test' }, 'link'))).toBe('<a href="/test">link</a>');
    });

    it('renders void elements', () => {
      expect(render(h('br', {}))).toBe('<br />');
    });

    it('renders nested elements', () => {
      const html = render(h('div', {}, h('span', {}, 'inner')));
      expect(html).toBe('<div><span>inner</span></div>');
    });
  });

  describe('escapeHtml()', () => {
    it('escapes all dangerous characters', () => {
      expect(escapeHtml('&<>"\'')).toBe('&amp;&lt;&gt;&quot;&#x27;');
    });

    it('leaves safe text unchanged', () => {
      expect(escapeHtml('hello world')).toBe('hello world');
    });
  });
});
