import { beforeEach, afterEach, chai, vi } from 'vitest'
import sinon from 'sinon'
import mongodb from 'mongodb'
import sinonChai from 'sinon-chai'
import chaiAsPromised from 'chai-as-promised'

chai.use(sinonChai)
chai.use(chaiAsPromised)

// ensure every ObjectId has the id string as a property for correct comparisons
mongodb.ObjectId.cacheHexString = true

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
  vi.doMock('@overleaf/logger', () => ({
    default: ctx.logger,
  }))
})

afterEach(() => {
  sandbox.reset()
  vi.restoreAllMocks()
  vi.resetModules()
})
