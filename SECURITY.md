# Security policy

`sanitize()` is a security boundary, so reports are taken seriously.

## Reporting a vulnerability

Please **do not open a public issue**. Use GitHub's private reporting instead:
**Security → Report a vulnerability** on this repository.

Include the input HTML, the options you passed, the output, and the browser where it runs code.
You'll get a reply within 7 days. Fixes for confirmed bypasses ship as a patch release, credited to you unless you prefer otherwise.

## Supported versions

Only the latest release gets security fixes.

## How we check

Every CI run and a weekly scheduled run:

- `sanitize()` against DOMPurify's suite of known XSS bypasses plus 50,000 fuzzed inputs, with outputs rendered in Chromium ([`security/xss.js`](security/xss.js)).
- `cargo deny`: Rust dependencies against the RustSec advisory database, plus license and source checks.
- `npm audit` on all JavaScript tooling. The published package itself has zero runtime dependencies.
- Renovate keeps dependencies current and opens security updates immediately.
