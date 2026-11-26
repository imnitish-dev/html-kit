'use strict';
// Node / Bun: load the native addon for this platform, fall back to WASM if none is shipped.
const path = require('node:path');
const { wrap } = require('./wrap.js');

function nativeName() {
  const { platform, arch } = process;
  if (platform === 'linux') {
    const glibc = process.report?.getReport?.().header?.glibcVersionRuntime;
    return `linux-${arch}-${glibc ? 'gnu' : 'musl'}`;
  }
  if (platform === 'win32') return `win32-${arch}-msvc`;
  return `${platform}-${arch}`;
}

function loadWasm() {
  const w = require('../wasm/html_scrub.js');
  w.initSync({ module: require('node:fs').readFileSync(path.join(__dirname, '../wasm/html_scrub_bg.wasm')) });
  return w;
}

let raw;
let backend = 'native';
try {
  if (process.env.HTML_SCRUB_FORCE_WASM) throw new Error('forced');
  raw = require(path.join(__dirname, `../native/html-scrub.${nativeName()}.node`));
} catch {
  raw = loadWasm();
  backend = 'wasm';
}

module.exports = { ...wrap(raw), backend };
