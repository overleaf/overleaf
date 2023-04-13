// This is copied from CM6, which does not expose it publicly.
// https://github.com/codemirror/view/blob/e7918b607753588a0b2a596e952068fa008bf84c/src/browser.ts
const nav: any =
  typeof navigator !== 'undefined'
    ? navigator
    : { userAgent: '', vendor: '', platform: '' }
const doc: any =
  typeof document !== 'undefined'
    ? document
    : { documentElement: { style: {} } }

const ieEdge = /Edge\/(\d+)/.exec(nav.userAgent)
const ieUpTo10 = /MSIE \d/.test(nav.userAgent)
const ie11Up = /Trident\/(?:[7-9]|\d{2,})\..*rv:(\d+)/.exec(nav.userAgent)
const ie = !!(ieUpTo10 || ie11Up || ieEdge)
const gecko = !ie && /gecko\/(\d+)/i.test(nav.userAgent)
const chrome = !ie && /Chrome\/(\d+)/.exec(nav.userAgent)
const webkit = 'webkitFontSmoothing' in doc.documentElement.style
const safari = !ie && /Apple Computer/.test(nav.vendor)
const ios =
  safari && (/Mobile\/\w+/.test(nav.userAgent) || nav.maxTouchPoints > 2)

export default {
  mac: ios || /Mac/.test(nav.platform),
  windows: /Win/.test(nav.platform),
  linux: /Linux|X11/.test(nav.platform),
  ie,
  ie_version: ieUpTo10
    ? doc.documentMode || 6
    : ie11Up
    ? +ie11Up[1]
    : ieEdge
    ? +ieEdge[1]
    : 0,
  gecko,
  gecko_version: gecko
    ? +(/Firefox\/(\d+)/.exec(nav.userAgent) || [0, 0])[1]
    : 0,
  chrome: !!chrome,
  chrome_version: chrome ? +chrome[1] : 0,
  ios,
  android: /Android\b/.test(nav.userAgent),
  webkit,
  safari,
  webkit_version: webkit
    ? +(/\bAppleWebKit\/(\d+)/.exec(navigator.userAgent) || [0, 0])[1]
    : 0,
  tabSize:
    doc.documentElement.style.tabSize != null ? 'tab-size' : '-moz-tab-size',
}
