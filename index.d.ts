export interface SanitizeOptions {
  /** Allowed tags. Replaces the default list. Removed tags keep their text. `script` and `style` are refused. */
  allowedTags?: string[];
  /**
   * Allowed attributes per tag; use `'*'` for any tag. Replaces the default list.
   * `on*` event handlers are refused.
   * @example { a: ['href', 'title'], img: ['src', 'alt'], '*': ['class'] }
   */
  allowedAttributes?: Record<string, string[]>;
  /** Allowed URL schemes for links and images. Replaces the default list. `javascript` and `vbscript` are refused. @example ['https', 'mailto'] */
  allowedSchemes?: string[];
}
/** Remove scripts, event handlers, `javascript:` URLs and anything else that can run code. Throws on unsafe options. */
export function sanitize(html: string, options?: SanitizeOptions): string;
/** Convert HTML to Markdown (CommonMark + GFM tables and strikethrough). `<script>`, `<style>`, `<head>`, `<svg>` and similar are dropped. */
export function toMarkdown(html: string): string;
/** Which engine is running: the native addon, or the WASM build. */
export const backend: 'native' | 'wasm';
