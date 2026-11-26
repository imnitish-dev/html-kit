// Cloudflare Workers / Vercel Edge: these runtimes forbid compiling WASM from bytes, so import the module.
import mod from '../wasm/html_scrub_bg.wasm';
import * as raw from '../wasm/html_scrub.js';
import { wrap } from './wrap.js';
raw.initSync({ module: mod });
export const { sanitize, toMarkdown } = wrap(raw);
export const backend = 'wasm';
