import { afterEach, beforeEach, chai, vi } from 'vitest'
import sinon from 'sinon'
import sinonChai from 'sinon-chai'
import chaiAsPromised from 'chai-as-promised'
import mongodb from 'mongodb-legacy'

// ensure every ObjectId has the id string as a property for correct comparisons
mongodb.ObjectId.cacheHexString = true

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

beforeEach(ctx => {
  ctx.logger = stubs.logger
  vi.doMock('@overleaf/logger', () => ({ default: ctx.logger }))
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.resetModules()
  sandbox.reset()
})
