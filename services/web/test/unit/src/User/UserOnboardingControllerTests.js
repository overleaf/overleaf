const SandboxedModule = require('sandboxed-module')
const modulePath =
  '../../../../app/src/Features/User/UserOnboardingController.js'
const { ObjectId } = require('mongodb')
const sinon = require('sinon')

describe('UserOnboardingController', function() {
  beforeEach(function() {
    this.date = new Date().getTime()
    sinon.useFakeTimers(this.date)

    this.users = [
      {
        _id: ObjectId('00000001f037be01a0e3a541')
      },
      {
        _id: ObjectId('00000001f037be01a0e3a542')
      },
      {
        _id: ObjectId('00000001f037be01a0e3a543')
      }
    ]

    this.mongodb = {
      db: {
        users: {
          find: sinon
            .stub()
            .returns({ toArray: sinon.stub().yields(null, this.users) })
        }
      },
      ObjectId: ObjectId
    }

    this.logger = {
      log() {}
    }

    this.UserUpdater = {
      updateUser: sinon.stub().callsArgWith(2, null)
    }

    this.EmailHandler = {
      sendEmail: sinon.stub().callsArgWith(2)
    }

    this.UserOnboardingController = SandboxedModule.require(modulePath, {
      requires: {
        '../../infrastructure/mongodb': this.mongodb,
        './UserUpdater': this.UserUpdater,
        '../Email/EmailHandler': this.EmailHandler,
        'logger-sharelatex': this.logger
      }
    })
    this.req = {}
    this.res = {
      setTimeout: sinon.stub()
    }
  })

  it('sends onboarding emails', function(done) {
    this.res.send = ids => {
      ids.length.should.equal(3)
      this.mongodb.db.users.find.calledOnce.should.equal(true)
      this.EmailHandler.sendEmail.calledThrice.should.equal(true)
      this.UserUpdater.updateUser.calledThrice.should.equal(true)
      for (var i = 0; i < 3; i++) {
        this.UserUpdater.updateUser
          .calledWith(
            this.users[0]._id,
            sinon.match({
              $set: { onboardingEmailSentAt: new Date(this.date) }
            })
          )
          .should.equal(true)
      }
      done()
    }
    this.UserOnboardingController.sendRecentSignupOnboardingEmails(
      this.req,
      this.res
    )
  })
})
