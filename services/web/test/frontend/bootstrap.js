// Run babel on tests to allow support for import/export statements in Node
require('@babel/register')({
  extensions: ['.ts', '.tsx', '.js', '.jsx', '.mjs'],
  plugins: [
    [
      'module-resolver',
      {
        alias: {
          '^@/(.+)': './frontend/js/\\1',
          '^@shared/(.+)': './shared/\\1',
          '^@modules/(.+)': './modules/\\1',
        },
      },
    ],
  ],
})

// Load JSDOM to mock the DOM in Node
// Set pretendToBeVisual to enable requestAnimationFrame
require('jsdom-global')(undefined, {
  pretendToBeVisual: true,
  url: 'https://www.test-overleaf.com/',
})

// JSDOM doesn't define devicePixelRatio, which @juggle/resize-observer's
// polyfill (used by virtualized lists) reads as a bare global on every
// observation tick
if (typeof global.devicePixelRatio === 'undefined') {
  global.devicePixelRatio = 1
  window.devicePixelRatio = 1
}

const path = require('path')
process.env.OVERLEAF_CONFIG = path.resolve(
  __dirname,
  '../../config/settings.webpack.js'
)

// Load sinon-chai assertions so expect(stubFn).to.have.been.calledWith('abc')
// has a nicer failure messages
const chai = require('chai')
chai.use(require('sinon-chai'))
chai.use(require('chai-as-promised'))

// Populate meta for top-level access in modules on import
const { resetMeta } = require('./helpers/reset-meta')
resetMeta()
// i18n requires access to 'ol-i18n' as defined above
require('../../frontend/js/i18n')

const moment = require('moment')
moment.updateLocale('en', {
  calendar: {
    lastDay: '[Yesterday]',
    sameDay: '[Today]',
    nextDay: '[Tomorrow]',
    lastWeek: 'ddd, Do MMM YY',
    nextWeek: 'ddd, Do MMM YY',
    sameElse: 'ddd, Do MMM YY',
  },
})

// workaround for missing keys in jsdom-global's keys.js
globalThis.AbortController = global.AbortController = window.AbortController
globalThis.MutationObserver = global.MutationObserver = window.MutationObserver
globalThis.StorageEvent = global.StorageEvent = window.StorageEvent
globalThis.SVGElement = global.SVGElement = window.SVGElement
globalThis.localStorage = global.localStorage = window.localStorage
globalThis.cancelAnimationFrame = global.cancelAnimationFrame =
  window.cancelAnimationFrame
globalThis.requestAnimationFrame = global.requestAnimationFrame =
  window.requestAnimationFrame
globalThis.sessionStorage = global.sessionStorage = window.sessionStorage

// add polyfill for ResizeObserver
globalThis.ResizeObserver =
  global.ResizeObserver =
  window.ResizeObserver =
    require('@juggle/resize-observer').ResizeObserver

// add stub for matchMedia (used by react-bootstrap's Offcanvas, among others)
globalThis.matchMedia =
  global.matchMedia =
  window.matchMedia =
    query => ({
      matches: false,
      media: query,
      onchange: null,
      addListener() {},
      removeListener() {},
      addEventListener() {},
      removeEventListener() {},
      dispatchEvent() {
        return false
      },
    })

// add stub for BroadcastChannel (unused in these tests)
globalThis.BroadcastChannel =
  global.BroadcastChannel =
  window.BroadcastChannel =
    class BroadcastChannel {
      // Unused arguments left to document the signature of the stubbed function.
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      addEventListener(type, listener) {}
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      removeEventListener(type, listener) {}
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      postMessage(message) {}
    }

// add stub for WebSocket state enum
globalThis.WebSocket = class WebSocket {
  static CONNECTING = 0
  static OPEN = 1
  static CLOSING = 2
  static CLOSED = 3
}

// node-fetch doesn't accept relative URL's: https://github.com/node-fetch/node-fetch/blob/master/docs/v2-LIMITS.md#known-differences
const fetch = require('node-fetch')
globalThis.fetch =
  global.fetch =
  window.fetch =
    (url, ...options) => fetch(new URL(url, 'http://127.0.0.1'), ...options)

// ignore style/image files
const { addHook } = require('pirates')
addHook(() => '', {
  exts: ['.css', '.scss', '.svg', '.png', '.gif', '.mp4', '.ort'],
  ignoreNodeModules: false,
})

globalThis.HTMLElement.prototype.scrollIntoView = () => {}

globalThis.DOMParser = window.DOMParser

// Polyfill for IndexedDB
require('fake-indexeddb/auto')

const fetchMock = require('fetch-mock').default

fetchMock.spyGlobal()
fetchMock.config.fetch = global.fetch
fetchMock.config.Response = fetch.Response

Object.defineProperty(navigator, 'onLine', {
  configurable: true,
  get: () => true,
})

// Reset the URL after each test. Some features (e.g. the project dashboard)
// push navigation state into the URL via history.pushState; because the jsdom
// window is shared across the whole run, a dirty path would otherwise leak into
// the next test's initial state and into the `page` field of analytics events.
exports.mochaHooks = {
  afterEach() {
    window.history.replaceState(null, '', '/')
  },
}
