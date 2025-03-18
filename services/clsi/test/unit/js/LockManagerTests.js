const { expect } = require('chai')
const sinon = require('sinon')
const SandboxedModule = require('sandboxed-module')
const modulePath = require('node:path').join(
  __dirname,
  '../../../app/js/LockManager'
)
const Errors = require('../../../app/js/Errors')

describe('LockManager', function () {
  beforeEach(function () {
    this.key = '/local/compile/directory'
    this.clock = sinon.useFakeTimers()
    this.LockManager = SandboxedModule.require(modulePath, {
      requires: {
        '@overleaf/metrics': (this.Metrics = {
          inc: sinon.stub(),
          gauge: sinon.stub(),
        }),
        '@overleaf/settings': (this.Settings = {
          compileConcurrencyLimit: 5,
        }),
        './Errors': (this.Erros = Errors),
        './RequestParser': { MAX_TIMEOUT: 600 },
      },
    })
  })

  afterEach(function () {
    this.clock.restore()
  })

  describe('when the lock is available', function () {
    it('the lock can be acquired', function () {
      const lock = this.LockManager.acquire(this.key)
      expect(lock).to.exist
      lock.release()
    })
  })

  describe('after the lock is acquired', function () {
    beforeEach(function () {
      this.lock = this.LockManager.acquire(this.key)
    })

    afterEach(function () {
      if (this.lock != null) {
        this.lock.release()
      }
    })

    it("the lock can't be acquired again", function () {
      expect(() => this.LockManager.acquire(this.key)).to.throw(
        Errors.AlreadyCompilingError
      )
    })

    it('another lock can be acquired', function () {
      const lock = this.LockManager.acquire('another key')
      expect(lock).to.exist
      lock.release()
    })

    it('the lock can be acquired again after an expiry period', function () {
      // The expiry time is a little bit over 10 minutes. Let's wait 15 minutes.
      this.clock.tick(15 * 60 * 1000)
      this.lock = this.LockManager.acquire(this.key)
      expect(this.lock).to.exist
    })

    it('the lock can be acquired again after it was released', function () {
      this.lock.release()
      this.lock = this.LockManager.acquire(this.key)
      expect(this.lock).to.exist
    })
  })

  describe('concurrency limit', function () {
    it('exceeding the limit', function () {
      for (let i = 0; i <= this.Settings.compileConcurrencyLimit; i++) {
        this.LockManager.acquire('test_key' + i)
      }
      this.Metrics.inc
        .calledWith('exceeded-compilier-concurrency-limit')
        .should.equal(false)
      expect(() =>
        this.LockManager.acquire(
          'test_key_' + (this.Settings.compileConcurrencyLimit + 1),
          false
        )
      ).to.throw(Errors.TooManyCompileRequestsError)

      this.Metrics.inc
        .calledWith('exceeded-compilier-concurrency-limit')
        .should.equal(true)
    })

    it('within the limit', function () {
      for (let i = 0; i <= this.Settings.compileConcurrencyLimit - 1; i++) {
        this.LockManager.acquire('test_key' + i)
      }
      this.Metrics.inc
        .calledWith('exceeded-compilier-concurrency-limit')
        .should.equal(false)

      const lock = this.LockManager.acquire(
        'test_key_' + this.Settings.compileConcurrencyLimit,
        false
      )

      expect(lock.key).to.equal(
        'test_key_' + this.Settings.compileConcurrencyLimit
      )
    })
  })
})
