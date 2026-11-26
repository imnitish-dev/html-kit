// XSS test for sanitize(): known payloads + random fuzzing, checked three ways.
//   cd security && npm install && node xss.js [iterations]
// Optional real-browser check: set CHROME=/path/to/chrome (or install playwright's chromium).
import fs from 'node:fs';
import { JSDOM } from 'jsdom';
import { sanitize, backend } from 'html-kit';

const ITERATIONS = Number(process.argv[2] ?? 50_000);

// 1. Known payloads: DOMPurify's test suite (Apache-2.0 / MPL-2.0), downloaded, not redistributed.
const cache = new URL('.cache/dompurify-expect.mjs', import.meta.url);
if (!fs.existsSync(cache)) {
  fs.mkdirSync(new URL('.cache', import.meta.url), { recursive: true });
  const res = await fetch('https://raw.githubusercontent.com/cure53/DOMPurify/main/test/fixtures/expect.mjs');
  if (!res.ok) throw new Error(`download failed: ${res.status}`);
  fs.writeFileSync(cache, await res.text());
}
const known = (await import(cache.href)).default.map((t) => t.payload).filter((p) => typeof p === 'string');

// 2. Random fuzzing: nasty tags, attributes and text, randomly nested, cased and left unclosed.
const TAGS = 'script img svg math iframe object embed a form input button details video audio source style textarea title noscript template xmp base meta link table select option mglyph mtext foreignObject desc annotation-xml frame body html div p b noembed plaintext listing'.split(' ');
const ATTRS = [
  'onerror=alert(1)', 'onload=alert(1)', 'onclick=alert(1)', 'onfocus=alert(1) autofocus', 'ontoggle=alert(1) open', 'onbegin=alert(1)',
  'href="javascript:alert(1)"', 'href="jav&#x09;ascript:alert(1)"', 'href="  JaVaScRiPt:alert(1)"', 'href="&#106;avascript:alert(1)"',
  'href="java\u0000script:alert(1)"', 'href="&#x6A;&#x61;&#x76;&#x61;&#x73;&#x63;&#x72;&#x69;&#x70;&#x74;:alert(1)"', 'href="vbscript:msgbox(1)"',
  'href="data:text/html,<script>alert(1)</script>"', 'src="javascript:alert(1)"', 'src=x', 'action="javascript:alert(1)"',
  'formaction="javascript:alert(1)"', 'xlink:href="javascript:alert(1)"', 'srcdoc="<script>alert(1)</script>"', 'data="javascript:alert(1)"',
  ...['\u2028', '\u2029', '\u00a0', '\u2000', '\u0001', '\ufeff', '\u200b', '&#x2028;', '&#xfeff;', '&#11;'].map((c) => `href="${c}javascript:alert(1)"`),
  'style="background:url(javascript:alert(1))"', 'style="x:expression(alert(1))"', 'encoding="text/html"', 'id=x', 'class=y', 'title="</p><img src=x onerror=alert(1)>"',
];
const TEXT = ['<!--', '-->', '<![CDATA[', ']]>', '</', '</p>', '&lt;img src=x onerror=alert(1)&gt;', '"', "'", '>', '<', 'alert(1)', '<script>alert(1)</script>', '<img src=x onerror=alert(1)>', '`', '&', 'hello'];

let seed = 42; // deterministic, so failures can be reproduced
const rand = (n) => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) % n);
const pick = (a) => a[rand(a.length)];
const randCase = (s) => (rand(3) ? s : [...s].map((c) => (rand(2) ? c.toUpperCase() : c)).join(''));
function gen(depth = 0) {
  let out = '';
  for (let i = 0, n = 1 + rand(3); i < n; i++) {
    if (depth > 3 || rand(3) === 0) { out += pick(TEXT); continue; }
    const tag = randCase(pick(TAGS));
    const attrs = Array.from({ length: rand(3) }, () => ' ' + pick(ATTRS)).join('');
    out += `<${tag}${attrs}>${gen(depth + 1)}${rand(4) ? `</${tag}>` : ''}`;
  }
  return out;
}

// Check 1: parse the output the way a browser would (innerHTML) and look for anything that can run code.
const { document } = new JSDOM('').window;
const EXEC_TAGS = new Set(['SCRIPT', 'IFRAME', 'FRAME', 'FRAMESET', 'OBJECT', 'EMBED', 'APPLET', 'BASE', 'META', 'LINK', 'STYLE', 'FORM', 'NOSCRIPT']);
const URL_ATTRS = new Set(['href', 'src', 'action', 'formaction', 'xlink:href', 'data', 'poster', 'background', 'codebase', 'cite', 'longdesc', 'srcset', 'ping']);
const BAD_URL = /^(javascript|vbscript|data:text\/html)/;
function dangers(html) {
  const div = document.createElement('div');
  div.innerHTML = html;
  const found = [];
  for (const el of div.querySelectorAll('*')) {
    if (EXEC_TAGS.has(el.tagName.toUpperCase())) found.push(`<${el.tagName.toLowerCase()}>`);
    for (const { name, value } of el.attributes) {
      const v = value.replace(/[\s\u0000-\u001f\u007f-\u009f\u00ad\u180e\u200b-\u200f\u2060-\u2064\ufeff]/g, '').toLowerCase(); // strictest reading
      if (name.startsWith('on') || name === 'srcdoc') found.push(`${name}=`);
      if (URL_ATTRS.has(name) && BAD_URL.test(v)) found.push(`${name}=${v.slice(0, 20)}`);
      if (name === 'style' && /javascript:|expression\(/.test(v)) found.push('style=');
    }
  }
  return found;
}

const failures = [];
const outputs = [];
function check(input, source) {
  let out;
  try { out = sanitize(input); } catch (e) { failures.push({ source, input, problem: `threw: ${e.message}` }); return; }
  const bad = dangers(out);
  if (bad.length) failures.push({ source, input, out, problem: `dangerous output: ${bad.join(', ')}` });
  if (sanitize(out) !== out) failures.push({ source, input, out, problem: 'not stable: sanitizing the output again changes it (possible mutation XSS)' });
  outputs.push(out);
}

const t0 = performance.now();
for (const p of known) check(p, 'DOMPurify suite');
for (let i = 0; i < ITERATIONS; i++) check(gen(), `fuzz #${i}`);
console.log(`backend: ${backend}`);
console.log(`static + stability: ${known.length} known payloads + ${ITERATIONS} fuzzed inputs in ${((performance.now() - t0) / 1000).toFixed(1)}s`);

// Check 3: real browser. Every output goes into its own iframe; alert/confirm/prompt/print report back if called.
async function browserCheck() {
  let chromium;
  try { ({ chromium } = await import('playwright-core')); } catch { return console.log('browser check: skipped (playwright-core missing)'); }
  let browser;
  try { browser = await chromium.launch(process.env.CHROME ? { executablePath: process.env.CHROME } : {}); }
  catch { return console.log('browser check: skipped (no Chromium found; set CHROME=/path/to/chrome)'); }
  const page = await browser.newPage();
  await page.setContent('<!doctype html><body>');
  const sample = [...outputs.slice(0, known.length), ...outputs.slice(known.length).filter((_, i) => i % Math.max(1, Math.floor(ITERATIONS / 3000)) === 0)];
  const hits = await page.evaluate(async (outs) => {
    const hits = new Set();
    window.__hit = (i) => hits.add(i);
    for (let start = 0; start < outs.length; start += 200) {
      const frames = outs.slice(start, start + 200).map((html, j) => {
        const f = document.createElement('iframe');
        const hook = `<script>for (const k of ['alert','confirm','prompt','print']) window[k] = () => parent.__hit(${start + j});<\/script>`;
        f.srcdoc = hook + html;
        document.body.append(f);
        return f;
      });
      await new Promise((r) => setTimeout(r, 800)); // let images fail, autofocus fire, animations start
      frames.forEach((f) => f.remove());
    }
    return [...hits];
  }, sample);
  await browser.close();
  for (const i of hits) failures.push({ source: 'browser', out: sample[i], problem: 'code executed in Chromium' });
  console.log(`browser check: ${sample.length} outputs rendered in Chromium ${browser.version()}, ${hits.length} executed code`);
}
await browserCheck();

if (failures.length) {
  console.log(`\n❌ ${failures.length} failures`);
  for (const f of failures.slice(0, 15)) console.log(JSON.stringify(f, null, 1).slice(0, 600));
  process.exit(1);
}
console.log('\n✅ no XSS found');
