const SandboxedModule = require('sandboxed-module')
const path = require('path')
const modulePath = path.join(
  __dirname,
  '../../../../app/src/infrastructure/FaultTolerantRequest'
)
const sinon = require('sinon')
const { expect } = require('chai')

describe('FaultTolerantRequest', function() {
  beforeEach(function() {
    this.request = sinon.stub().yields()
    this.logger = {
      err: sinon.stub()
    }
    this.FaultTolerantRequest = SandboxedModule.require(modulePath, {
      globals: {
        console: console
      },
      requires: {
        requestretry: this.request,
        'logger-sharelatex': this.logger
      }
    })
  })

  describe('exponentialBackoffStrategy', function() {
    it('returns delays within expected range with default options', function() {
      this.FaultTolerantRequest.request({}, () => {})
      const delayStrategy = this.request.lastCall.args[0].delayStrategy
      expect(delayStrategy()).to.be.closeTo(500, 250) // attempt 1
      expect(delayStrategy()).to.be.closeTo(750, 375) // attempt 2
      expect(delayStrategy()).to.be.closeTo(1125, 563) // attempt 3
      expect(delayStrategy()).to.be.closeTo(1688, 844) // attempt 4
      expect(delayStrategy()).to.be.closeTo(2531, 1266) // attempt 5
      expect(delayStrategy()).to.be.closeTo(3797, 1899) // attempt 6
      expect(delayStrategy()).to.be.closeTo(5695, 2848) // attempt 7
      expect(delayStrategy()).to.be.closeTo(8543, 4272) // attempt 8
      expect(delayStrategy()).to.be.closeTo(12814, 6408) // attempt 9
      expect(delayStrategy()).to.be.closeTo(19222, 9610) // attempt 10
    })

    it('returns delays within expected range with custom options', function() {
      const delayStrategy = this.FaultTolerantRequest.exponentialDelayStrategy(
        3000,
        3,
        0.5
      )
      expect(delayStrategy()).to.be.closeTo(3000, 1500) // attempt 1
      expect(delayStrategy()).to.be.closeTo(9000, 4500) // attempt 2
      expect(delayStrategy()).to.be.closeTo(27000, 13500) // attempt 3
      expect(delayStrategy()).to.be.closeTo(81000, 40500) // attempt 4
      expect(delayStrategy()).to.be.closeTo(243000, 121500) // attempt 5
      expect(delayStrategy()).to.be.closeTo(729000, 364500) // attempt 6
      expect(delayStrategy()).to.be.closeTo(2187000, 1093500) // attempt 7
      expect(delayStrategy()).to.be.closeTo(6561000, 3280500) // attempt 8
      expect(delayStrategy()).to.be.closeTo(19683000, 9841500) // attempt 9
      expect(delayStrategy()).to.be.closeTo(59049000, 29524500) // attempt 10
    })
  })

  describe('request', function() {
    it('sets retry options', function(done) {
      this.FaultTolerantRequest.request({}, error => {
        expect(error).to.not.exist
        sinon.assert.calledOnce(this.request)

        const { delayStrategy, maxAttempts } = this.request.lastCall.args[0]
        expect(delayStrategy).to.be.a('function')
        expect(maxAttempts).to.be.a('number')
        done()
      })
    })

    it("don't overwrite retry options", function(done) {
      const customMaxAttempts = Math.random()
      const customBase = Math.random()
      const customMultiplier = Math.random()
      const customRandomFactor = Math.random()
      this.FaultTolerantRequest.request(
        {
          maxAttempts: customMaxAttempts,
          backoffBase: customBase,
          backoffMultiplier: customMultiplier,
          backoffRandomFactor: customRandomFactor
        },
        error => {
          expect(error).to.not.exist

          const {
            maxAttempts,
            backoffBase,
            backoffMultiplier,
            backoffRandomFactor
          } = this.request.lastCall.args[0]
          expect(maxAttempts).to.equal(customMaxAttempts)
          expect(backoffBase).to.equal(customBase)
          expect(backoffMultiplier).to.equal(customMultiplier)
          expect(backoffRandomFactor).to.equal(customRandomFactor)
          done()
        }
      )
    })
  })

  describe('backgroundRequest', function() {
    it('logs error in the background', function(done) {
      this.request.yields(new Error('Nope'))
      this.logger.err = (options, message) => {
        expect(options.url).to.equal('test.url')
        done()
      }
      this.FaultTolerantRequest.backgroundRequest(
        { url: 'test.url' },
        error => {
          expect(error).to.not.exist
        }
      )
    })
  })
})
