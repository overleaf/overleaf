const { expect } = require('chai')
const sinon = require('sinon')
const LockManager = require('../../../app/js/LockManager')
const Errors = require('../../../app/js/Errors')

describe('LockManager', function () {
  beforeEach(function () {
    this.key = '/local/compile/directory'
    this.clock = sinon.useFakeTimers()
  })

  afterEach(function () {
    this.clock.restore()
  })

  describe('when the lock is available', function () {
    it('the lock can be acquired', function () {
      const lock = LockManager.acquire(this.key)
      expect(lock).to.exist
      lock.release()
    })
  })

  describe('after the lock is acquired', function () {
    beforeEach(function () {
      this.lock = LockManager.acquire(this.key)
    })

    afterEach(function () {
      if (this.lock != null) {
        this.lock.release()
      }
    })

    it("the lock can't be acquired again", function () {
      expect(() => LockManager.acquire(this.key)).to.throw(
        Errors.AlreadyCompilingError
      )
    })

    it('another lock can be acquired', function () {
      const lock = LockManager.acquire('another key')
      expect(lock).to.exist
      lock.release()
    })

    it('the lock can be acquired again after an expiry period', function () {
      // The expiry time is a little bit over 10 minutes. Let's wait 15 minutes.
      this.clock.tick(15 * 60 * 1000)
      this.lock = LockManager.acquire(this.key)
      expect(this.lock).to.exist
    })

    it('the lock can be acquired again after it was released', function () {
      this.lock.release()
      this.lock = LockManager.acquire(this.key)
      expect(this.lock).to.exist
    })
  })
})
