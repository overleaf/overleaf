import { afterEach, beforeEach, chai, vi } from 'vitest'
import sinon from 'sinon'
import chaiAsPromised from 'chai-as-promised'
import sinonChai from 'sinon-chai'

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

// Mocha hooks
beforeEach(ctx => {
  ctx.logger = stubs.logger
  vi.doMock('@overleaf/logger', () => ({ default: ctx.logger }))
})

afterEach(() => {
  sandbox.reset()
  vi.restoreAllMocks()
  vi.resetModules()
})
