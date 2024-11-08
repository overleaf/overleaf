const Path = require('path')
const chai = require('chai')
const sinon = require('sinon')

/*
 * Chai configuration
 */

// add chai.should()
chai.should()

// Load sinon-chai assertions so expect(stubFn).to.have.been.calledWith('abc')
// has a nicer failure messages
chai.use(require('sinon-chai'))

// Load promise support for chai
chai.use(require('chai-as-promised'))

// Do not truncate assertion errors
chai.config.truncateThreshold = 0

// add support for mongoose in sinon
require('sinon-mongoose')

// ensure every ObjectId has the id string as a property for correct comparisons
require('mongodb-legacy').ObjectId.cacheHexString = true

/*
 * Global stubs
 */
const globalStubsSandbox = sinon.createSandbox()
const globalStubs = {
  logger: {
    debug: globalStubsSandbox.stub(),
    info: globalStubsSandbox.stub(),
    log: globalStubsSandbox.stub(),
    warn: globalStubsSandbox.stub(),
    err: globalStubsSandbox.stub(),
    error: globalStubsSandbox.stub(),
    fatal: globalStubsSandbox.stub(),
  },
}

/*
 * Sandboxed module configuration
 */

const SandboxedModule = require('sandboxed-module')
SandboxedModule.configure({
  ignoreMissing: true,
  requires: getSandboxedModuleRequires(),
  globals: {
    AbortController,
    AbortSignal,
    Buffer,
    Promise,
    console,
    process,
    URL,
    TextEncoder,
    TextDecoder,
  },
  sourceTransformers: {
    removeNodePrefix: function (source) {
      return source.replace(/require\(['"]node:/g, "require('")
    },
  },
})

function getSandboxedModuleRequires() {
  const requires = {
    '@overleaf/logger': globalStubs.logger,
  }

  const internalModules = [
    '../../app/src/Features/Errors/Errors',
    '../../app/src/Features/Helpers/Mongo',
  ]
  const externalLibs = [
    'async',
    'bull',
    'json2csv',
    'lodash',
    'marked',
    'moment',
    '@overleaf/o-error',
    'sanitize-html',
    'sshpk',
    'xml2js',
    'mongodb',
  ]
  for (const modulePath of internalModules) {
    requires[Path.resolve(__dirname, modulePath)] = require(modulePath)
  }
  for (const lib of externalLibs) {
    requires[lib] = require(lib)
  }
  return requires
}

/*
 * Mocha hooks
 */

// sandboxed-module somehow registers every fake module it creates in this
// module's children array, which uses quite a big amount of memory. We'll take
// a copy of the module children array and restore it after each test so that
// the garbage collector has a chance to reclaim the fake modules.
let initialModuleChildren

exports.mochaHooks = {
  beforeAll() {
    // Record initial module children
    initialModuleChildren = module.children.slice()
  },

  beforeEach() {
    // Install logger stub
    this.logger = globalStubs.logger
  },

  afterEach() {
    // Delete leaking sandboxed modules
    module.children = initialModuleChildren.slice()

    // Reset global stubs
    globalStubsSandbox.reset()

    // Restore other stubs
    sinon.restore()
  },
}
