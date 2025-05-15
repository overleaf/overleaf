import { vi } from 'vitest'
import './common_bootstrap.js'
import sinon from 'sinon'
import logger from '@overleaf/logger'

vi.mock('@overleaf/logger', async () => {
  return {
    default: {
      debug: vi.fn(),
      info: vi.fn(),
      log: vi.fn(),
      warn: vi.fn(),
      err: vi.fn(),
      error: vi.fn(),
      fatal: vi.fn(),
    },
  }
})

beforeEach(ctx => {
  ctx.logger = logger
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.resetModules()
  sinon.restore()
})
