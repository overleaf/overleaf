// Run babel on tests to allow support for import/export statements in Node
require('@babel/register')({
  extensions: ['.ts', '.tsx', '.js', '.jsx'],
})

// Load JSDOM to mock the DOM in Node
// Set pretendToBeVisual to enable requestAnimationFrame
require('jsdom-global')(undefined, {
  pretendToBeVisual: true,
  url: 'https://www.test-overleaf.com/',
})

const path = require('path')
process.env.SHARELATEX_CONFIG = path.resolve(
  __dirname,
  '../../config/settings.webpack.js'
)

// Load sinon-chai assertions so expect(stubFn).to.have.been.calledWith('abc')
// has a nicer failure messages
const chai = require('chai')
chai.use(require('sinon-chai'))
chai.use(require('chai-as-promised'))

// Mock global settings
window.ExposedSettings = {
  appName: 'Overleaf',
  maxEntitiesPerProject: 10,
  maxUploadSize: 5 * 1024 * 1024,
  siteUrl: 'https://www.dev-overleaf.com',
  hasLinkUrlFeature: true,
  hasLinkedProjectFileFeature: true,
  hasLinkedProjectOutputFileFeature: true,
  textExtensions: [
    'tex',
    'latex',
    'sty',
    'cls',
    'bst',
    'bib',
    'bibtex',
    'txt',
    'tikz',
    'mtx',
    'rtex',
    'md',
    'asy',
    'latexmkrc',
    'lbx',
    'bbx',
    'cbx',
    'm',
    'lco',
    'dtx',
    'ins',
    'ist',
    'def',
    'clo',
    'ldf',
    'rmd',
    'lua',
    'gv',
    'mf',
  ],
}

window.i18n = { currentLangCode: 'en' }
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
globalThis.performance = global.performance = window.performance
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

// node-fetch doesn't accept relative URL's: https://github.com/node-fetch/node-fetch/blob/master/docs/v2-LIMITS.md#known-differences
const fetch = require('node-fetch')
globalThis.fetch =
  global.fetch =
  window.fetch =
    (url, ...options) => fetch(new URL(url, 'http://localhost'), ...options)

// ignore CSS files
const { addHook } = require('pirates')
addHook(() => '', { exts: ['.css'], ignoreNodeModules: false })
