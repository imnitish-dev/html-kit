export const wrap = (w) => ({
  sanitize: (html, options) => w.sanitize(String(html), options?.allowedTags),
  toMarkdown: (html) => w.toMarkdown(String(html)),
});
