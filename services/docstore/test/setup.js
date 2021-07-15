const chai = require('chai')
const sinon = require('sinon')
const sinonChai = require('sinon-chai')
const chaiAsPromised = require('chai-as-promised')
const SandboxedModule = require('sandboxed-module')

// Chai configuration
chai.should()
chai.use(sinonChai)
chai.use(chaiAsPromised)

// Global stubs
const sandbox = sinon.createSandbox()
const stubs = {
  logger: {
    log: sandbox.stub(),
    warn: sandbox.stub(),
    err: sandbox.stub(),
    error: sandbox.stub(),
    fatal: sandbox.stub(),
  },
}

// SandboxedModule configuration
SandboxedModule.configure({
  requires: {
    'logger-sharelatex': stubs.logger,
  },
  globals: { Buffer, JSON, console, process },
})

exports.mochaHooks = {
  beforeEach() {
    this.logger = stubs.logger
  },

  afterEach() {
    sandbox.reset()
  },
}
