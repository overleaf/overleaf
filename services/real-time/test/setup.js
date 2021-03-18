const chai = require('chai')
const SandboxedModule = require('sandboxed-module')
const sinon = require('sinon')

// Chai configuration
chai.should()

// Global stubs
const sandbox = sinon.createSandbox()
const stubs = {
  logger: {
    debug: sandbox.stub(),
    log: sandbox.stub(),
    info: sandbox.stub(),
    warn: sandbox.stub(),
    err: sandbox.stub(),
    error: sandbox.stub()
  }
}

// SandboxedModule configuration
SandboxedModule.configure({
  requires: {
    'logger-sharelatex': stubs.logger
  },
  globals: { Buffer, JSON, console, process }
})

// Mocha hooks
exports.mochaHooks = {
  beforeEach() {
    this.logger = stubs.logger
  },

  afterEach() {
    sandbox.reset()
  }
}
