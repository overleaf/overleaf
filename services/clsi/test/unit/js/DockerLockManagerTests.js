/* eslint-disable
    no-return-assign,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const SandboxedModule = require('sandboxed-module')
const sinon = require('sinon')
const modulePath = require('node:path').join(
  __dirname,
  '../../../app/js/DockerLockManager'
)

describe('LockManager', function () {
  beforeEach(function () {
    return (this.LockManager = SandboxedModule.require(modulePath, {
      requires: {
        '@overleaf/settings': (this.Settings = { clsi: { docker: {} } }),
      },
    }))
  })

  return describe('runWithLock', function () {
    describe('with a single lock', function () {
      beforeEach(function (done) {
        this.callback = sinon.stub()
        return this.LockManager.runWithLock(
          'lock-one',
          releaseLock =>
            setTimeout(() => releaseLock(null, 'hello', 'world'), 100),

          (err, ...args) => {
            this.callback(err, ...Array.from(args))
            return done()
          }
        )
      })

      return it('should call the callback', function () {
        return this.callback
          .calledWith(null, 'hello', 'world')
          .should.equal(true)
      })
    })

    describe('with two locks', function () {
      beforeEach(function (done) {
        this.callback1 = sinon.stub()
        this.callback2 = sinon.stub()
        this.LockManager.runWithLock(
          'lock-one',
          releaseLock =>
            setTimeout(() => releaseLock(null, 'hello', 'world', 'one'), 100),

          (err, ...args) => {
            return this.callback1(err, ...Array.from(args))
          }
        )
        return this.LockManager.runWithLock(
          'lock-two',
          releaseLock =>
            setTimeout(() => releaseLock(null, 'hello', 'world', 'two'), 200),

          (err, ...args) => {
            this.callback2(err, ...Array.from(args))
            return done()
          }
        )
      })

      it('should call the first callback', function () {
        return this.callback1
          .calledWith(null, 'hello', 'world', 'one')
          .should.equal(true)
      })

      return it('should call the second callback', function () {
        return this.callback2
          .calledWith(null, 'hello', 'world', 'two')
          .should.equal(true)
      })
    })

    return describe('with lock contention', function () {
      describe('where the first lock is released quickly', function () {
        beforeEach(function (done) {
          this.LockManager.MAX_LOCK_WAIT_TIME = 1000
          this.LockManager.LOCK_TEST_INTERVAL = 100
          this.callback1 = sinon.stub()
          this.callback2 = sinon.stub()
          this.LockManager.runWithLock(
            'lock',
            releaseLock =>
              setTimeout(() => releaseLock(null, 'hello', 'world', 'one'), 100),

            (err, ...args) => {
              return this.callback1(err, ...Array.from(args))
            }
          )
          return this.LockManager.runWithLock(
            'lock',
            releaseLock =>
              setTimeout(() => releaseLock(null, 'hello', 'world', 'two'), 200),

            (err, ...args) => {
              this.callback2(err, ...Array.from(args))
              return done()
            }
          )
        })

        it('should call the first callback', function () {
          return this.callback1
            .calledWith(null, 'hello', 'world', 'one')
            .should.equal(true)
        })

        return it('should call the second callback', function () {
          return this.callback2
            .calledWith(null, 'hello', 'world', 'two')
            .should.equal(true)
        })
      })

      describe('where the first lock is held longer than the waiting time', function () {
        beforeEach(function (done) {
          let doneTwo
          this.LockManager.MAX_LOCK_HOLD_TIME = 10000
          this.LockManager.MAX_LOCK_WAIT_TIME = 1000
          this.LockManager.LOCK_TEST_INTERVAL = 100
          this.callback1 = sinon.stub()
          this.callback2 = sinon.stub()
          let doneOne = (doneTwo = false)
          const finish = function (key) {
            if (key === 1) {
              doneOne = true
            }
            if (key === 2) {
              doneTwo = true
            }
            if (doneOne && doneTwo) {
              return done()
            }
          }
          this.LockManager.runWithLock(
            'lock',
            releaseLock =>
              setTimeout(
                () => releaseLock(null, 'hello', 'world', 'one'),
                1100
              ),

            (err, ...args) => {
              this.callback1(err, ...Array.from(args))
              return finish(1)
            }
          )
          return this.LockManager.runWithLock(
            'lock',
            releaseLock =>
              setTimeout(() => releaseLock(null, 'hello', 'world', 'two'), 100),

            (err, ...args) => {
              this.callback2(err, ...Array.from(args))
              return finish(2)
            }
          )
        })

        it('should call the first callback', function () {
          return this.callback1
            .calledWith(null, 'hello', 'world', 'one')
            .should.equal(true)
        })

        return it('should call the second callback with an error', function () {
          const error = sinon.match.instanceOf(Error)
          return this.callback2.calledWith(error).should.equal(true)
        })
      })

      return describe('where the first lock is held longer than the max holding time', function () {
        beforeEach(function (done) {
          let doneTwo
          this.LockManager.MAX_LOCK_HOLD_TIME = 1000
          this.LockManager.MAX_LOCK_WAIT_TIME = 2000
          this.LockManager.LOCK_TEST_INTERVAL = 100
          this.callback1 = sinon.stub()
          this.callback2 = sinon.stub()
          let doneOne = (doneTwo = false)
          const finish = function (key) {
            if (key === 1) {
              doneOne = true
            }
            if (key === 2) {
              doneTwo = true
            }
            if (doneOne && doneTwo) {
              return done()
            }
          }
          this.LockManager.runWithLock(
            'lock',
            releaseLock =>
              setTimeout(
                () => releaseLock(null, 'hello', 'world', 'one'),
                1500
              ),

            (err, ...args) => {
              this.callback1(err, ...Array.from(args))
              return finish(1)
            }
          )
          return this.LockManager.runWithLock(
            'lock',
            releaseLock =>
              setTimeout(() => releaseLock(null, 'hello', 'world', 'two'), 100),

            (err, ...args) => {
              this.callback2(err, ...Array.from(args))
              return finish(2)
            }
          )
        })

        it('should call the first callback', function () {
          return this.callback1
            .calledWith(null, 'hello', 'world', 'one')
            .should.equal(true)
        })

        return it('should call the second callback', function () {
          return this.callback2
            .calledWith(null, 'hello', 'world', 'two')
            .should.equal(true)
        })
      })
    })
  })
})
