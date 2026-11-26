
### sanitize: small (user comment), 1 KB

| Library | ms per call | vs fastest |
|---|---|---|
| html-kit (native) | 0.019 | **fastest** |
| html-kit (wasm) | 0.031 | 1.6× slower |
| sanitize-html | 0.041 | 2.2× slower |
| DOMPurify + jsdom | 0.271 | 14.4× slower |

### sanitize: large (Wikipedia article), 685 KB

| Library | ms per call | vs fastest |
|---|---|---|
| html-kit (native) | 12.7 | **fastest** |
| html-kit (wasm) | 17.9 | 1.4× slower |
| sanitize-html | 20.6 | 1.6× slower |
| DOMPurify + jsdom | 127.3 | 10.1× slower |

### sanitize: medium (MDN docs page), 221 KB

| Library | ms per call | vs fastest |
|---|---|---|
| html-kit (native) | 3.9 | **fastest** |
| html-kit (wasm) | 5.0 | 1.3× slower |
| sanitize-html | 6.2 | 1.6× slower |
| DOMPurify + jsdom | 39.2 | 10.0× slower |

### HTML → Markdown: small (user comment), 1 KB

| Library | ms per call | vs fastest |
|---|---|---|
| html-kit (native) | 0.016 | **fastest** |
| html-kit (wasm) | 0.026 | 1.6× slower |
| turndown | 0.135 | 8.3× slower |
| node-html-markdown | 0.085 | 5.2× slower |

### HTML → Markdown: large (Wikipedia article), 685 KB

| Library | ms per call | vs fastest |
|---|---|---|
| html-kit (native) | 15.3 | **fastest** |
| html-kit (wasm) | 21.4 | 1.4× slower |
| turndown | 58.0 | 3.8× slower |
| node-html-markdown | 512.4 | 33.5× slower |

### HTML → Markdown: medium (MDN docs page), 221 KB

| Library | ms per call | vs fastest |
|---|---|---|
| html-kit (native) | 3.5 | **fastest** |
| html-kit (wasm) | 4.9 | 1.4× slower |
| turndown | 17.5 | 5.0× slower |
| node-html-markdown | 35.1 | 10.1× slower |

Node v24.18.0, darwin-arm64
