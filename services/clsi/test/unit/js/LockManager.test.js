import { vi, expect, describe, beforeEach, afterEach, it } from 'vitest'
import sinon from 'sinon'
import * as Errors from '../../../app/js/Errors.js'
import path from 'node:path'

const modulePath = path.join(import.meta.dirname, '../../../app/js/LockManager')

describe('LockManager', () => {
  beforeEach(async ctx => {
    ctx.key = '/local/compile/directory'
    ctx.clock = sinon.useFakeTimers()

    vi.doMock('@overleaf/metrics', () => ({
      default: (ctx.Metrics = {
        inc: sinon.stub(),
        gauge: sinon.stub(),
      }),
    }))

    vi.doMock('@overleaf/settings', () => ({
      default: (ctx.Settings = {
        compileConcurrencyLimit: 5,
      }),
    }))

    vi.doMock('../../../app/js/Errors', () => ({
      default: (ctx.Erros = Errors),
    }))

    vi.doMock('../../../app/js/RequestParser', () => ({
      default: { MAX_TIMEOUT: 600 },
    }))

    ctx.LockManager = (await import(modulePath)).default
  })

  afterEach(ctx => {
    ctx.clock.restore()
  })

  describe('when the lock is available', () => {
    it('the lock can be acquired', ctx => {
      const lock = ctx.LockManager.acquire(ctx.key)
      expect(lock).to.exist
      lock.release()
    })
  })

  describe('after the lock is acquired', () => {
    beforeEach(ctx => {
      ctx.lock = ctx.LockManager.acquire(ctx.key)
    })

    afterEach(ctx => {
      if (ctx.lock != null) {
        ctx.lock.release()
      }
    })

    it("the lock can't be acquired again", ctx => {
      expect(() => ctx.LockManager.acquire(ctx.key)).to.throw(
        Errors.AlreadyCompilingError
      )
    })

    it('another lock can be acquired', ctx => {
      const lock = ctx.LockManager.acquire('another key')
      expect(lock).to.exist
      lock.release()
    })

    it('the lock can be acquired again after an expiry period', ctx => {
      // The expiry time is a little bit over 10 minutes. Let's wait 15 minutes.
      ctx.clock.tick(15 * 60 * 1000)
      ctx.lock = ctx.LockManager.acquire(ctx.key)
      expect(ctx.lock).to.exist
    })

    it('the lock can be acquired again after it was released', ctx => {
      ctx.lock.release()
      ctx.lock = ctx.LockManager.acquire(ctx.key)
      expect(ctx.lock).to.exist
    })
  })

  describe('concurrency limit', () => {
    it('exceeding the limit', ctx => {
      for (let i = 0; i <= ctx.Settings.compileConcurrencyLimit; i++) {
        ctx.LockManager.acquire('test_key' + i)
      }
      ctx.Metrics.inc
        .calledWith('exceeded-compilier-concurrency-limit')
        .should.equal(false)
      expect(() =>
        ctx.LockManager.acquire(
          'test_key_' + (ctx.Settings.compileConcurrencyLimit + 1),
          false
        )
      ).to.throw(Errors.TooManyCompileRequestsError)

      ctx.Metrics.inc
        .calledWith('exceeded-compilier-concurrency-limit')
        .should.equal(true)
    })

    it('within the limit', ctx => {
      for (let i = 0; i <= ctx.Settings.compileConcurrencyLimit - 1; i++) {
        ctx.LockManager.acquire('test_key' + i)
      }
      ctx.Metrics.inc
        .calledWith('exceeded-compilier-concurrency-limit')
        .should.equal(false)

      const lock = ctx.LockManager.acquire(
        'test_key_' + ctx.Settings.compileConcurrencyLimit,
        false
      )

      expect(lock.key).to.equal(
        'test_key_' + ctx.Settings.compileConcurrencyLimit
      )
    })
  })
})
