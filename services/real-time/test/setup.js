const chai = require('chai')
const SandboxedModule = require('sandboxed-module')
const sinon = require('sinon')
const chaiAsPromised = require('chai-as-promised')
const sinonChai = require('sinon-chai')

// Chai configuration
chai.should()
chai.use(chaiAsPromised)
chai.use(sinonChai)

// Global stubs
const sandbox = sinon.createSandbox()
const stubs = {
  logger: {
    debug: sandbox.stub(),
    log: sandbox.stub(),
    info: sandbox.stub(),
    warn: sandbox.stub(),
    err: sandbox.stub(),
    error: sandbox.stub(),
  },
}

// SandboxedModule configuration
SandboxedModule.configure({
  requires: {
    '@overleaf/logger': stubs.logger,
  },
  globals: { Buffer, JSON, console, process },
  sourceTransformers: {
    removeNodePrefix: function (source) {
      return source.replace(/require\(['"]node:/g, "require('")
    },
  },
})

// Mocha hooks
exports.mochaHooks = {
  beforeEach() {
    this.logger = stubs.logger
  },

  afterEach() {
    sandbox.reset()
  },
}
