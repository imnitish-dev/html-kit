import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { sanitize, toMarkdown, backend } from 'html-scrub';

const XSS = [
  '<img src=x onerror=alert(1)>',
  '<a href="javascript:alert(1)">x</a>',
  '<a href="JaVaScRiPt:alert(1)">x</a>',
  '<svg><script>alert(1)</script></svg>',
  '<iframe src="https://evil.example"></iframe>',
  '<div style="background:url(javascript:alert(1))">x</div>',
  '<math><mtext><table><mglyph><style><img src=x onerror=alert(1)>',
  '<form action="javascript:alert(1)"><button>x</button></form>',
  '<p onmouseover="alert(1)">x</p>',
  '<object data="data:text/html,<script>alert(1)</script>"></object>',
];

test(`backend is ${backend}`, () => {
  assert.ok(['native', 'wasm'].includes(backend));
  // CI sets this so a missing or broken native binary fails loudly instead of silently using WASM.
  if (process.env.HTML_SCRUB_EXPECT) assert.equal(backend, process.env.HTML_SCRUB_EXPECT);
});

test('sanitize removes every XSS vector', () => {
  for (const x of XSS) {
    const out = sanitize(x).toLowerCase();
    for (const bad of ['<script', 'onerror', 'onmouseover', 'javascript:', '<iframe', '<object', '<form', 'style=']) {
      assert.ok(!out.includes(bad), `${x} -> ${out}`);
    }
  }
});

test('sanitize keeps safe content', () => {
  assert.equal(sanitize('<p>Hello <b>world</b></p>'), '<p>Hello <b>world</b></p>');
});

test('sanitize allowedTags', () => {
  assert.equal(sanitize('<b>a</b><i>b</i>', { allowedTags: ['b'] }), '<b>a</b>b');
});

test('sanitize allowedAttributes and allowedSchemes', () => {
  const html = '<a href="https://x.dev" class="c" title="t">l</a><a href="mailto:a@b.c">m</a><img src="https://x.dev/a.png" alt="a">';
  const out = sanitize(html, { allowedAttributes: { a: ['href'], '*': ['class'] }, allowedSchemes: ['https'] });
  assert.match(out, /href="https:\/\/x\.dev"/);
  assert.match(out, /class="c"/);
  assert.doesNotMatch(out, /title=|mailto|src=/);
});

test('unsafe options throw instead of crashing', () => {
  assert.throws(() => sanitize('x', { allowedTags: ['script'] }), /runs code/);
  assert.throws(() => sanitize('x', { allowedAttributes: { a: ['onclick'] } }), /event handler/);
  assert.throws(() => sanitize('x', { allowedSchemes: ['javascript'] }), /run code/);
  assert.equal(sanitize('<b>still works</b>'), '<b>still works</b>');
});

test('toMarkdown strikethrough', () => {
  assert.equal(toMarkdown('<p><del>old</del> new</p>'), '~~old~~ new');
});

test('toMarkdown', () => {
  const md = toMarkdown('<h2>Title</h2><p>Some <em>text</em> and <a href="https://a.b">link</a>.</p><script>x()</script><ul><li>one</li><li>two</li></ul><pre><code>let a = 1;</code></pre>');
  for (const s of ['## Title', '*text*', '- one', '[link](https://a.b)', 'one', 'two', 'let a = 1;']) assert.ok(md.includes(s), md);
  assert.ok(!md.includes('x()'), md);
});

test('CommonJS require works too', () => {
  const cjs = createRequire(import.meta.url)('html-scrub');
  assert.equal(cjs.sanitize('<b onclick="x">a</b>'), '<b>a</b>');
});
