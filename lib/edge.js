// Cloudflare Workers / Vercel Edge: these runtimes forbid compiling WASM from bytes, so import the module.
import mod from '../wasm/html_kit_bg.wasm';
import { initSync } from '../wasm/html_kit.js';
import * as w from '../wasm/html_kit.js';
import { wrap } from './wrap.js';
initSync({ module: mod });
export const { sanitize, toMarkdown } = wrap(w);
export const backend = 'wasm';
