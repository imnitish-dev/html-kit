export interface SanitizeOptions {
  /** Replace the default allowlist of tags. Everything else is removed (its text is kept). */
  allowedTags?: string[];
}
/** Remove scripts, event handlers, `javascript:` URLs and anything else that can run code. */
export function sanitize(html: string, options?: SanitizeOptions): string;
/** Convert HTML to Markdown. `<script>`, `<style>`, `<head>` and similar are dropped. */
export function toMarkdown(html: string): string;
/** Which engine is running: the native addon, or the WASM build. */
export const backend: 'native' | 'wasm';
