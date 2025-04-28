import esmock from 'esmock'
import path from 'node:path'

import sinon from 'sinon'
import { expect } from 'chai'
import { fileURLToPath } from 'node:url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))

const modulePath = path.join(
  __dirname,
  '../../../../app/src/Features/BetaProgram/BetaProgramHandler'
)

describe('BetaProgramHandler', function () {
  beforeEach(async function () {
    this.user_id = 'some_id'
    this.user = {
      _id: this.user_id,
      email: 'user@example.com',
      features: {},
      betaProgram: false,
      save: sinon.stub().callsArgWith(0, null),
    }
    this.handler = await esmock.strict(modulePath, {
      '@overleaf/metrics': {
        inc: sinon.stub(),
      },
      '../../../../app/src/Features/User/UserUpdater': (this.UserUpdater = {
        promises: {
          updateUser: sinon.stub().resolves(),
        },
      }),
      '../../../../app/src/Features/Analytics/AnalyticsManager':
        (this.AnalyticsManager = {
          setUserPropertyForUserInBackground: sinon.stub(),
        }),
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
