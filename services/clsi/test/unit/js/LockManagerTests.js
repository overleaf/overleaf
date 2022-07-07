const { expect } = require('chai')
const sinon = require('sinon')
const mockFs = require('mock-fs')
const OError = require('@overleaf/o-error')
const LockManager = require('../../../app/js/LockManager')
const Errors = require('../../../app/js/Errors')

describe('LockManager', function () {
  beforeEach(function () {
    this.lockFile = '/local/compile/directory/.project-lock'
    mockFs({
      '/local/compile/directory': {},
    })
    this.clock = sinon.useFakeTimers()
  })

  afterEach(function () {
    mockFs.restore()
    this.clock.restore()
  })

  describe('when the lock is available', function () {
    it('the lock can be acquired', async function () {
      await LockManager.acquire(this.lockFile)
    })

    it('acquiring a lock in a nonexistent directory throws an error with debug info', async function () {
      const err = await expect(
        LockManager.acquire('/invalid/path/.project-lock')
      ).to.be.rejected
      const info = OError.getFullInfo(err)
      expect(info).to.have.keys(['statLock', 'statDir', 'readdirDir'])
      expect(info.statLock.code).to.equal('ENOENT')
      expect(info.statDir.code).to.equal('ENOENT')
      expect(info.readdirDir.code).to.equal('ENOENT')
    })
  })

  describe('after the lock is acquired', function () {
    beforeEach(async function () {
      this.lock = await LockManager.acquire(this.lockFile)
    })

    it("the lock can't be acquired again", function (done) {
      const promise = LockManager.acquire(this.lockFile)
      // runAllAsync() will advance through time until there are no pending
      // timers or promises. It interferes with Mocha's promise interface, so
      // we use Mocha's callback interface for this test.
      this.clock.runAllAsync()
      expect(promise)
        .to.be.rejectedWith(Errors.AlreadyCompilingError)
        .then(() => {
          done()
        })
        .catch(err => {
          done(err)
        })
    })

    it('the lock can be acquired again after an expiry period', async function () {
      // The expiry time is 5 minutes. Let's wait 10 minutes.
      this.clock.tick(10 * 60 * 1000)
      await LockManager.acquire(this.lockFile)
    })

    it('the lock can be acquired again after it was released', async function () {
      this.lock.release()
      await LockManager.acquire(this.lockFile)
    })
  })
})
