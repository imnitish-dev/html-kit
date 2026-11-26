'use strict';
// Node / Bun: load the native addon for this platform, fall back to WASM if none is shipped.
const path = require('node:path');

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
  const fs = require('node:fs');
  const w = require('../wasm/html_kit.js');
  w.initSync({ module: fs.readFileSync(path.join(__dirname, '../wasm/html_kit_bg.wasm')) });
  return w;
}

let backend;
let impl;
try {
  if (process.env.HTML_KIT_FORCE_WASM) throw new Error('forced');
  impl = require(path.join(__dirname, `../native/html-kit.${nativeName()}.node`));
  backend = 'native';
} catch {
  const w = loadWasm();
  impl = { sanitize: (html, o) => w.sanitize(html, o?.allowedTags), toMarkdown: w.toMarkdown };
  backend = 'wasm';
}

module.exports = {
  sanitize: (html, options) => impl.sanitize(String(html), options),
  toMarkdown: (html) => impl.toMarkdown(String(html)),
  backend,
};
