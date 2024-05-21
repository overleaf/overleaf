const SandboxedModule = require('sandboxed-module')
const path = require('path')
const modulePath = path.join(
  __dirname,
  '../../../../app/src/Features/BetaProgram/BetaProgramHandler'
)
const sinon = require('sinon')
const { expect } = require('chai')

describe('BetaProgramHandler', function () {
  beforeEach(function () {
    this.user_id = 'some_id'
    this.user = {
      _id: this.user_id,
      email: 'user@example.com',
      features: {},
      betaProgram: false,
      save: sinon.stub().callsArgWith(0, null),
    }
    this.handler = SandboxedModule.require(modulePath, {
      requires: {
        '@overleaf/metrics': {
          inc: sinon.stub(),
        },
        '../User/UserUpdater': (this.UserUpdater = {
          promises: {
            updateUser: sinon.stub().resolves(),
          },
        }),
        '../Analytics/AnalyticsManager': (this.AnalyticsManager = {
          setUserPropertyForUserInBackground: sinon.stub(),
        }),
      },
    })
  })

  describe('optIn', function () {
    beforeEach(function () {
      this.user.betaProgram = false
      this.call = callback => {
        this.handler.optIn(this.user_id, callback)
      }
    })

    it('should call userUpdater', function (done) {
      this.call(err => {
        expect(err).to.not.exist
        this.UserUpdater.promises.updateUser.callCount.should.equal(1)
        done()
      })
    })

    it('should set beta-program user property to true', function (done) {
      this.call(err => {
        expect(err).to.not.exist
        sinon.assert.calledWith(
          this.AnalyticsManager.setUserPropertyForUserInBackground,
          this.user_id,
          'beta-program',
          true
        )
        done()
      })
    })

    it('should not produce an error', function (done) {
      this.call(err => {
        expect(err).to.not.exist
        done()
      })
    })

    describe('when userUpdater produces an error', function () {
      beforeEach(function () {
        this.UserUpdater.promises.updateUser.rejects()
      })

      it('should produce an error', function (done) {
        this.call(err => {
          expect(err).to.exist
          expect(err).to.be.instanceof(Error)
          done()
        })
      })
    })
  })

  describe('optOut', function () {
    beforeEach(function () {
      this.user.betaProgram = true
      this.call = callback => {
        this.handler.optOut(this.user_id, callback)
      }
    })

    it('should call userUpdater', function (done) {
      this.call(err => {
        expect(err).to.not.exist
        this.UserUpdater.promises.updateUser.callCount.should.equal(1)
        done()
      })
    })

    it('should set beta-program user property to false', function (done) {
      this.call(err => {
        expect(err).to.not.exist
        sinon.assert.calledWith(
          this.AnalyticsManager.setUserPropertyForUserInBackground,
          this.user_id,
          'beta-program',
          false
        )
        done()
      })
    })

    it('should not produce an error', function (done) {
      this.call(err => {
        expect(err).to.not.exist
        done()
      })
    })

    describe('when userUpdater produces an error', function () {
      beforeEach(function () {
        this.UserUpdater.promises.updateUser.rejects()
      })

      it('should produce an error', function (done) {
        this.call(err => {
          expect(err).to.exist
          expect(err).to.be.instanceof(Error)
          done()
        })
      })
    })
  })
})
