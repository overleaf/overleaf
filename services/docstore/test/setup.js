const chai = require('chai')
const sinon = require('sinon')
const sinonChai = require('sinon-chai')
const chaiAsPromised = require('chai-as-promised')
const SandboxedModule = require('sandboxed-module')
const timersPromises = require('node:timers/promises')

// ensure every ObjectId has the id string as a property for correct comparisons
require('mongodb-legacy').ObjectId.cacheHexString = true

process.env.BACKEND = 'gcs'

// Chai configuration
chai.should()
chai.use(sinonChai)
chai.use(chaiAsPromised)

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
    fatal: sandbox.stub(),
  },
}

// SandboxedModule configuration
SandboxedModule.configure({
  requires: {
    '@overleaf/logger': stubs.logger,
    'timers/promises': timersPromises,
    'mongodb-legacy': require('mongodb-legacy'),
  },
  globals: { Buffer, JSON, Math, console, process },
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
