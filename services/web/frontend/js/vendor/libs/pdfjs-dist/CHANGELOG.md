# 2021-07-05

For https://github.com/overleaf/issues/issues/4503#issuecomment-873961735

#### Fork base

Based on v2.2.228 (d7afb74a6e1980da5041f376e7a7c7caef5f42ea)

#### Changes:

- fix handling of fetch errors (9826c6eb1ecd501ac3eb1e9d9a98a3e6edde3fd0)
- do not bundle NodeJS stream backend (6d118ec35e6e6f954938a485178748f1bb8bdd8a)

#### Reproducing of artifacts

- NodeJS v10.23.3 in docker
- npm v6.14.11 in docker
- `pdf.js$ npm ci`
- `pdf.js$ npx gulp generic`
- `pdf.js$ cp build/generic/build/pdf.* build/generic/LICENSE HERE/build`

#### Testing

PDF.JS does not properly handle network errors for range requests. Any of the initial probe request or following chunk requests can get the editor stuck.

Once any of the requests has failed, the current pdf.js document is stuck and it's (loading) promise never resolves/rejects. This is in turn breaking the frontend cleanup ahead of switching the pdf. New successful compiles will get queued on top of the stuck promise.

https://github.com/overleaf/web-internal/blob/9ed96cd93d3c4d3b23ff223c658ce80bc895484a/frontend/js/ide/pdfng/directives/pdfRenderer.js#L549-L552

https://github.com/overleaf/web-internal/blob/9ed96cd93d3c4d3b23ff223c658ce80bc895484a/frontend/js/ide/pdfng/directives/pdfViewer.js#L46-L47

Steps to reproduce:

### old (and new) logs ui

- set network speed to something very slow (the chrome dev-tools allow custom profiles, set 1kb/s up/down and 1s latency)
- wait for the compile response to arrive (see new pending requests for log/pdf)
- trigger a clear cache in another browser tab
- resume fast network speed

### new logs ui

- open dropdown of (re-)compile button
- set network speed to something very slow
- wait for the compile response to arrive (see new pending requests for log/pdf)
- click re-compile from scratch (which shifts over the stop compile open of the dropdown)
- resume fast network speed

Alternative reproduction steps involving hacking the ssl-proxy:

- https://digital-science.slack.com/archives/C0216GDEG9L/p1625240302143900
- https://digital-science.slack.com/archives/C0216GDEG9L/p1625238107141300
