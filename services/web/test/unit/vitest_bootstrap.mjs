import { vi } from 'vitest'
import './common_bootstrap.js'
import sinon from 'sinon'
import logger from '@overleaf/logger'

vi.mock('@overleaf/logger', async () => {
  const sinon = (await import('sinon')).default
  return {
    default: {
      debug: sinon.stub(),
      info: sinon.stub(),
      log: sinon.stub(),
      warn: sinon.stub(),
      err: sinon.stub(),
      error: sinon.stub(),
      fatal: sinon.stub(),
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
