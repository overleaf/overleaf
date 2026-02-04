import { afterEach, beforeEach, chai, vi } from 'vitest'
import sinonChai from 'sinon-chai'
import chaiAsPromised from 'chai-as-promised'

// Setup chai
chai.should()
chai.use(sinonChai)
chai.use(chaiAsPromised)

beforeEach(() => {
  vi.doMock('@overleaf/logger', () => ({
    default: {
      debug() {},
      log() {},
      info() {},
      warn() {},
      error() {},
      err() {},
    },
  }))
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.resetModules()
})
