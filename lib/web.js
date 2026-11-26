// Browsers, Deno, anything with fetch + top-level await. Loads the .wasm next to this file.
import init, * as raw from '../wasm/html_scrub.js';
import { wrap } from './wrap.js';
await init({ module_or_path: new URL('../wasm/html_scrub_bg.wasm', import.meta.url) });
export const { sanitize, toMarkdown } = wrap(raw);
export const backend = 'wasm';
