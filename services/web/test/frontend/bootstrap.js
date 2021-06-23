// Run babel on tests to allow support for import/export statements in Node
require('@babel/register')

// Load JSDOM to mock the DOM in Node
// Set pretendToBeVisual to enable requestAnimationFrame
require('jsdom-global')(undefined, {
  pretendToBeVisual: true,
  url: 'https://www.test-overleaf.com/',
})

// workaround for "keys.js in jsdom-global doesn't include AbortController"
global.AbortController = window.AbortController

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

let inMemoryLocalStorage = {}
Object.defineProperty(global, 'localStorage', {
  value: {
    // localStorage returns `null` when the item does not exist
    getItem: key =>
      inMemoryLocalStorage[key] !== undefined
        ? inMemoryLocalStorage[key]
        : null,
    setItem: (key, value) => (inMemoryLocalStorage[key] = value),
    clear: () => (inMemoryLocalStorage = {}),
    removeItem: key => delete inMemoryLocalStorage[key],
  },
  writable: true,
})

// node-fetch doesn't accept relative URL's: https://github.com/node-fetch/node-fetch/blob/master/docs/v2-LIMITS.md#known-differences
const fetch = require('node-fetch')
global.fetch = window.fetch = (url, ...options) =>
  fetch(new URL(url, 'http://localhost'), ...options)

// ignore CSS files
const { addHook } = require('pirates')
addHook(() => '', { exts: ['.css'], ignoreNodeModules: false })
