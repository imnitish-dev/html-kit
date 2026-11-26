// Browsers, Deno, anything with fetch + top-level await. Loads the .wasm next to this file.
import init, * as w from '../wasm/html_kit.js';
import { wrap } from './wrap.js';
await init({ module_or_path: new URL('../wasm/html_kit_bg.wasm', import.meta.url) });
export const { sanitize, toMarkdown } = wrap(w);
export const backend = 'wasm';
