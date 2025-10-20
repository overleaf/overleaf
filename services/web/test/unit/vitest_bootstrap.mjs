import { chai, vi } from 'vitest'
import './common_bootstrap.js'
import sinon from 'sinon'
import logger from '@overleaf/logger'
import sinonChai from 'sinon-chai'
import chaiAsPromised from 'chai-as-promised'
import SandboxedModule from 'sandboxed-module'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)

SandboxedModule.configure({
  ignoreMissing: true,
  requires: {
    // This is already imported the same way in the mocha bootstrap
    // eslint-disable-next-line import/no-extraneous-dependencies
    sshpk: require('sshpk'),
  },
  globals: {
    AbortController,
    AbortSignal,
    Buffer,
    Promise,
    console,
    process,
    URL,
    TextEncoder,
    TextDecoder,
  },
  sourceTransformers: {
    removeNodePrefix: function (source) {
      return source.replace(/require\(['"]node:/g, "require('")
    },
  },
})

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
  vi.restoreAllMocks()
  vi.resetModules()
  sinon.restore()
})
