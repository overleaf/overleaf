import { vi, describe, beforeEach, it } from 'vitest'

import sinon from 'sinon'
import path from 'node:path'
const modulePath = path.join(
  import.meta.dirname,
  '../../../app/js/DockerLockManager'
)

describe('DockerLockManager', function () {
  beforeEach(async function (ctx) {
    vi.doMock('@overleaf/settings', () => ({
      default: (ctx.Settings = { clsi: { docker: {} } }),
    }))

    return (ctx.LockManager = (await import(modulePath)).default)
  })

  return describe('runWithLock', function () {
    describe('with a single lock', function () {
      beforeEach(async function (ctx) {
        await new Promise((resolve, reject) => {
          ctx.callback = sinon.stub()
          return ctx.LockManager.runWithLock(
            'lock-one',
            releaseLock =>
              setTimeout(() => releaseLock(null, 'hello', 'world'), 100),

            (err, ...args) => {
              ctx.callback(err, ...Array.from(args))
              return resolve()
            }
          )
        })
      })

      return it('should call the callback', function (ctx) {
        return ctx.callback
          .calledWith(null, 'hello', 'world')
          .should.equal(true)
      })
    })

    describe('with two locks', function () {
      beforeEach(async function (ctx) {
        await new Promise((resolve, reject) => {
          ctx.callback1 = sinon.stub()
          ctx.callback2 = sinon.stub()
          ctx.LockManager.runWithLock(
            'lock-one',
            releaseLock =>
              setTimeout(() => releaseLock(null, 'hello', 'world', 'one'), 100),

            (err, ...args) => {
              return ctx.callback1(err, ...Array.from(args))
            }
          )
          return ctx.LockManager.runWithLock(
            'lock-two',
            releaseLock =>
              setTimeout(() => releaseLock(null, 'hello', 'world', 'two'), 200),

            (err, ...args) => {
              ctx.callback2(err, ...Array.from(args))
              return resolve()
            }
          )
        })
      })

      it('should call the first callback', function (ctx) {
        return ctx.callback1
          .calledWith(null, 'hello', 'world', 'one')
          .should.equal(true)
      })

      return it('should call the second callback', function (ctx) {
        return ctx.callback2
          .calledWith(null, 'hello', 'world', 'two')
          .should.equal(true)
      })
    })

    return describe('with lock contention', function () {
      describe('where the first lock is released quickly', function () {
        beforeEach(async function (ctx) {
          await new Promise((resolve, reject) => {
            ctx.LockManager.MAX_LOCK_WAIT_TIME = 1000
            ctx.LockManager.LOCK_TEST_INTERVAL = 100
            ctx.callback1 = sinon.stub()
            ctx.callback2 = sinon.stub()
            ctx.LockManager.runWithLock(
              'lock',
              releaseLock =>
                setTimeout(
                  () => releaseLock(null, 'hello', 'world', 'one'),
                  100
                ),

              (err, ...args) => {
                return ctx.callback1(err, ...Array.from(args))
              }
            )
            return ctx.LockManager.runWithLock(
              'lock',
              releaseLock =>
                setTimeout(
                  () => releaseLock(null, 'hello', 'world', 'two'),
                  200
                ),

              (err, ...args) => {
                ctx.callback2(err, ...Array.from(args))
                return resolve()
              }
            )
          })
        })

        it('should call the first callback', function (ctx) {
          return ctx.callback1
            .calledWith(null, 'hello', 'world', 'one')
            .should.equal(true)
        })

        return it('should call the second callback', function (ctx) {
          return ctx.callback2
            .calledWith(null, 'hello', 'world', 'two')
            .should.equal(true)
        })
      })

      describe('where the first lock is held longer than the waiting time', function () {
        beforeEach(async function (ctx) {
          await new Promise((resolve, reject) => {
            let doneTwo
            ctx.LockManager.MAX_LOCK_HOLD_TIME = 10000
            ctx.LockManager.MAX_LOCK_WAIT_TIME = 1000
            ctx.LockManager.LOCK_TEST_INTERVAL = 100
            ctx.callback1 = sinon.stub()
            ctx.callback2 = sinon.stub()
            let doneOne = (doneTwo = false)
            const finish = function (key) {
              if (key === 1) {
                doneOne = true
              }
              if (key === 2) {
                doneTwo = true
              }
              if (doneOne && doneTwo) {
                return resolve()
              }
            }
            ctx.LockManager.runWithLock(
              'lock',
              releaseLock =>
                setTimeout(
                  () => releaseLock(null, 'hello', 'world', 'one'),
                  1100
                ),

              (err, ...args) => {
                ctx.callback1(err, ...Array.from(args))
                return finish(1)
              }
            )
            return ctx.LockManager.runWithLock(
              'lock',
              releaseLock =>
                setTimeout(
                  () => releaseLock(null, 'hello', 'world', 'two'),
                  100
                ),

              (err, ...args) => {
                ctx.callback2(err, ...Array.from(args))
                return finish(2)
              }
            )
          })
        })

        it('should call the first callback', function (ctx) {
          return ctx.callback1
            .calledWith(null, 'hello', 'world', 'one')
            .should.equal(true)
        })

        return it('should call the second callback with an error', function (ctx) {
          const error = sinon.match.instanceOf(Error)
          return ctx.callback2.calledWith(error).should.equal(true)
        })
      })

      return describe('where the first lock is held longer than the max holding time', function () {
        beforeEach(async function (ctx) {
          await new Promise((resolve, reject) => {
            let doneTwo
            ctx.LockManager.MAX_LOCK_HOLD_TIME = 1000
            ctx.LockManager.MAX_LOCK_WAIT_TIME = 2000
            ctx.LockManager.LOCK_TEST_INTERVAL = 100
            ctx.callback1 = sinon.stub()
            ctx.callback2 = sinon.stub()
            let doneOne = (doneTwo = false)
            const finish = function (key) {
              if (key === 1) {
                doneOne = true
              }
              if (key === 2) {
                doneTwo = true
              }
              if (doneOne && doneTwo) {
                return resolve()
              }
            }
            ctx.LockManager.runWithLock(
              'lock',
              releaseLock =>
                setTimeout(
                  () => releaseLock(null, 'hello', 'world', 'one'),
                  1500
                ),

              (err, ...args) => {
                ctx.callback1(err, ...Array.from(args))
                return finish(1)
              }
            )
            return ctx.LockManager.runWithLock(
              'lock',
              releaseLock =>
                setTimeout(
                  () => releaseLock(null, 'hello', 'world', 'two'),
                  100
                ),

              (err, ...args) => {
                ctx.callback2(err, ...Array.from(args))
                return finish(2)
              }
            )
          })
        })

        it('should call the first callback', function (ctx) {
          return ctx.callback1
            .calledWith(null, 'hello', 'world', 'one')
            .should.equal(true)
        })

        return it('should call the second callback', function (ctx) {
          return ctx.callback2
            .calledWith(null, 'hello', 'world', 'two')
            .should.equal(true)
        })
      })
    })
  })
})
