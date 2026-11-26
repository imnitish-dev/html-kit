
### sanitize: small (user comment), 1 KB

| Library | ms per call | vs fastest |
|---|---|---|
| html-scrub (native) | 0.019 | **fastest** |
| html-scrub (wasm) | 0.027 | 1.5× slower |
| sanitize-html | 0.039 | 2.1× slower |
| DOMPurify + jsdom | 0.252 | 13.6× slower |

### sanitize: large (Wikipedia article), 685 KB

| Library | ms per call | vs fastest |
|---|---|---|
| html-scrub (native) | 12.6 | **fastest** |
| html-scrub (wasm) | 17.0 | 1.4× slower |
| sanitize-html | 19.0 | 1.5× slower |
| DOMPurify + jsdom | 124.4 | 9.9× slower |

### sanitize: medium (MDN docs page), 221 KB

| Library | ms per call | vs fastest |
|---|---|---|
| html-scrub (native) | 3.7 | **fastest** |
| html-scrub (wasm) | 5.0 | 1.3× slower |
| sanitize-html | 6.1 | 1.6× slower |
| DOMPurify + jsdom | 40.7 | 10.9× slower |

### HTML → Markdown: small (user comment), 1 KB

| Library | ms per call | vs fastest |
|---|---|---|
| html-scrub (native) | 0.016 | **fastest** |
| html-scrub (wasm) | 0.026 | 1.6× slower |
| turndown | 0.135 | 8.2× slower |
| node-html-markdown | 0.086 | 5.2× slower |

### HTML → Markdown: large (Wikipedia article), 685 KB

| Library | ms per call | vs fastest |
|---|---|---|
| html-scrub (native) | 15.7 | **fastest** |
| html-scrub (wasm) | 21.9 | 1.4× slower |
| turndown | 60.1 | 3.8× slower |
| node-html-markdown | 508.2 | 32.3× slower |

### HTML → Markdown: medium (MDN docs page), 221 KB

| Library | ms per call | vs fastest |
|---|---|---|
| html-scrub (native) | 3.5 | **fastest** |
| html-scrub (wasm) | 5.0 | 1.4× slower |
| turndown | 17.4 | 5.0× slower |
| node-html-markdown | 35.0 | 10.1× slower |

Node v24.18.0, darwin-arm64
