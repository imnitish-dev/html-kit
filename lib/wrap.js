// Turns the raw binding (native or WASM, same shape) into the public API.
export const wrap = (raw) => ({
  sanitize(html, { allowedTags, allowedAttributes, allowedSchemes } = {}) {
    // { a: ['href'], '*': ['class'] } -> ['a href', '* class']
    const attributes = allowedAttributes && Object.entries(allowedAttributes).flatMap(([tag, names]) => [].concat(names).map((n) => `${tag} ${n}`));
    return raw.sanitizeRaw(String(html), allowedTags ?? undefined, attributes ?? undefined, allowedSchemes ?? undefined);
  },
  toMarkdown: (html) => raw.toMarkdown(String(html)),
});
