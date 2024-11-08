const sinon = require('sinon')
const SandboxedModule = require('sandboxed-module')

// ensure every ObjectId has the id string as a property for correct comparisons
require('mongodb').ObjectId.cacheHexString = true

const sandbox = sinon.createSandbox()
const stubs = {
  logger: {
    debug: sandbox.stub(),
    log: sandbox.stub(),
    info: sandbox.stub(),
    warn: sandbox.stub(),
    err: sandbox.stub(),
    error: sandbox.stub(),
    fatal: sandbox.stub(),
  },
}

SandboxedModule.configure({
  requires: {
    '@overleaf/logger': stubs.logger,
  },
  sourceTransformers: {
    removeNodePrefix: function (source) {
      return source.replace(/require\(['"]node:/g, "require('")
    },
  },
})

exports.mochaHooks = {
  beforeEach() {
    this.logger = stubs.logger
  },

  afterEach() {
    sandbox.reset()
  },
}
