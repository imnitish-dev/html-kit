// Run: cd bench && npm install && node bench.js   (build the package first: npm run build)
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import sanitizeHtml from 'sanitize-html';
import createDOMPurify from 'dompurify';
import { JSDOM } from 'jsdom';
import TurndownService from 'turndown';
import { NodeHtmlMarkdown } from 'node-html-markdown';

const require = createRequire(import.meta.url);
const root = fileURLToPath(new URL('..', import.meta.url));

// Our two engines, loaded side by side.
// Both go through the same public wrapper users get.
const { wrap } = await import(`${root}lib/wrap.js`);
const native = wrap(require(`${root}native/html-kit.${process.platform}-${process.arch}.node`));
const wasmRaw = await import(`${root}wasm/html_kit.js`);
wasmRaw.initSync({ module: fs.readFileSync(`${root}wasm/html_kit_bg.wasm`) });
const wasm = wrap(wasmRaw);

const DOMPurify = createDOMPurify(new JSDOM('').window);
const turndown = new TurndownService();

// Real pages, downloaded once.
const PAGES = {
  'large (Wikipedia article)': 'https://en.wikipedia.org/wiki/JavaScript',
  'medium (MDN docs page)': 'https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/a',
};
fs.mkdirSync(new URL('fixtures', import.meta.url), { recursive: true });
const fixtures = {
  'small (user comment)': '<p>Great post! <b>Thanks</b> for sharing <a href="https://example.com">this link</a>.</p><ul><li>one</li><li>two</li></ul><img src=x onerror=alert(1)><script>steal()</script>'.repeat(3),
};
for (const [name, url] of Object.entries(PAGES)) {
  const file = new URL(`fixtures/${name.split(' ')[0]}.html`, import.meta.url);
  if (!fs.existsSync(file)) fs.writeFileSync(file, await (await fetch(url, { headers: { 'user-agent': 'html-kit-bench' } })).text());
  fixtures[name] = fs.readFileSync(file, 'utf8');
}

function bench(fn, input, ms = 1500) {
  for (let i = 0; i < 5; i++) fn(input); // warm up
  let n = 0;
  const start = performance.now();
  while (performance.now() - start < ms) { fn(input); n++; }
  return (performance.now() - start) / n; // ms per call
}

const SUITES = {
  'sanitize': {
    'html-kit (native)': (h) => native.sanitize(h),
    'html-kit (wasm)': (h) => wasm.sanitize(h),
    'sanitize-html': (h) => sanitizeHtml(h),
    'DOMPurify + jsdom': (h) => DOMPurify.sanitize(h),
  },
  'HTML → Markdown': {
    'html-kit (native)': (h) => native.toMarkdown(h),
    'html-kit (wasm)': (h) => wasm.toMarkdown(h),
    'turndown': (h) => turndown.turndown(h),
    'node-html-markdown': (h) => NodeHtmlMarkdown.translate(h),
  },
};

const results = [];
for (const [suite, libs] of Object.entries(SUITES)) {
  for (const [page, html] of Object.entries(fixtures)) {
    const kb = (Buffer.byteLength(html) / 1024).toFixed(0);
    console.log(`\n### ${suite}: ${page}, ${kb} KB\n\n| Library | ms per call | vs fastest |\n|---|---|---|`);
    const rows = Object.entries(libs).map(([lib, fn]) => [lib, bench(fn, html)]);
    const best = Math.min(...rows.map((r) => r[1]));
    for (const [lib, ms] of rows) {
      console.log(`| ${lib} | ${ms < 1 ? ms.toFixed(3) : ms.toFixed(1)} | ${ms === best ? '**fastest**' : `${(ms / best).toFixed(1)}× slower`} |`);
      results.push({ suite, page, kb: +kb, lib, ms });
    }
  }
}
fs.writeFileSync(new URL('results.json', import.meta.url), JSON.stringify({ node: process.version, platform: `${process.platform}-${process.arch}`, date: new Date().toISOString().slice(0, 10), results }, null, 2));
console.log(`\nNode ${process.version}, ${process.platform}-${process.arch}`);
