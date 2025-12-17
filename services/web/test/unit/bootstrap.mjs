import { afterEach, beforeEach, chai, vi } from 'vitest'
import 'sinon-mongoose'
import sinon from 'sinon'
import logger from '@overleaf/logger'
import sinonChai from 'sinon-chai'
import chaiAsPromised from 'chai-as-promised'
import mongoose from 'mongoose'
import mongodb from 'mongodb-legacy'

mongodb.ObjectId.cacheHexString = true

/*
 * Chai configuration
 */

// add chai.should()
chai.should()

// Load sinon-chai assertions so expect(stubFn).to.have.been.calledWith('abc')
// has a nicer failure messages
chai.use(sinonChai)

// Load promise support for chai
chai.use(chaiAsPromised)

// Do not truncate assertion errors
chai.config.truncateThreshold = 0
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
  // This function is a utility to duplicate the behaviour of passing `done` in place of `next` in an express route handler.
  ctx.rejectOnError = reject => {
    return err => {
      if (err) {
        reject(err)
      }
    }
  }
  ctx.logger = logger
})

afterEach(() => {
  vi.resetAllMocks()
  vi.resetModules()
  sinon.restore()
  const modelNames = mongoose.modelNames()
  modelNames.forEach(name => {
    delete mongoose.connection.models[name]
  })
})
