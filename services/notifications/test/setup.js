import { afterEach, chai, vi } from 'vitest'
import mongodb from 'mongodb-legacy'
import chaiAsPromised from 'chai-as-promised'

// Chai configuration
chai.should()
chai.use(chaiAsPromised)

// ensure every ObjectId has the id string as a property for correct comparisons
mongodb.ObjectId.cacheHexString = true

vi.mock('@overleaf/logger', () => ({
  default: {
    debug: vi.fn(),
    log: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    err: vi.fn(),
    error: vi.fn(),
    fatal: vi.fn(),
  },
}))

afterEach(() => {
  vi.restoreAllMocks()
  vi.resetModules()
})
