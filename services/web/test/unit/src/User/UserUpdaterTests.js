const should = require('chai').should()
const SandboxedModule = require('sandboxed-module')
const path = require('path')
const sinon = require('sinon')
const modulePath = path.join(
  __dirname,
  '../../../../app/src/Features/User/UserUpdater'
)
const tk = require('timekeeper')
const { expect } = require('chai')

describe('UserUpdater', function() {
  beforeEach(function() {
    tk.freeze(Date.now())
    this.mongojs = {
      db: {},
      ObjectId(id) {
        return id
      }
    }
    this.UserGetter = {
      getUserEmail: sinon.stub(),
      getUserByAnyEmail: sinon.stub(),
      ensureUniqueEmailAddress: sinon.stub(),
      promises: {
        getUser: sinon.stub()
      }
    }
    this.logger = {
      error: sinon.stub(),
      log() {},
      warn: sinon.stub()
    }
    this.addAffiliation = sinon.stub().yields()
    this.removeAffiliation = sinon.stub().callsArgWith(2, null)
    this.refreshFeatures = sinon.stub().yields()
    this.NewsletterManager = {
      promises: {
        changeEmail: sinon.stub()
      }
    }
    this.RecurlyWrapper = {
      promises: {
        updateAccountEmailAddress: sinon.stub()
      }
    }
    this.UserUpdater = SandboxedModule.require(modulePath, {
      globals: {
        console: console
      },
      requires: {
        'logger-sharelatex': this.logger,
        '../../infrastructure/mongojs': this.mongojs,
        'metrics-sharelatex': {
          timeAsyncMethod: sinon.stub()
        },
        './UserGetter': this.UserGetter,
        '../Institutions/InstitutionsAPI': {
          addAffiliation: this.addAffiliation,
          removeAffiliation: this.removeAffiliation
        },
        '../../infrastructure/Features': (this.Features = {
          hasFeature: sinon.stub().returns(false)
        }),
        '../Subscription/FeaturesUpdater': {
          refreshFeatures: this.refreshFeatures
        },
        'settings-sharelatex': (this.settings = {}),
        request: (this.request = {}),
        '../Newsletter/NewsletterManager': this.NewsletterManager,
        '../Subscription/RecurlyWrapper': this.RecurlyWrapper
      }
    })

    this.stubbedUser = {
      _id: '3131231',
      name: 'bob',
      email: 'hello@world.com'
    }
    this.newEmail = 'bob@bob.com'
    this.callback = sinon.stub()
  })

  afterEach(function() {
    return tk.reset()
  })

  describe('addAffiliationForNewUser', function(done) {
    beforeEach(function() {
      this.UserUpdater.updateUser = sinon
        .stub()
        .callsArgWith(2, null, { n: 1, nModified: 1, ok: 1 })
    })
    it('should not remove affiliationUnchecked flag if v1 returns an error', function(done) {
      this.addAffiliation.yields(true)
      this.UserUpdater.addAffiliationForNewUser(
        this.stubbedUser._id,
        this.newEmail,
        (error, updated) => {
          expect(error).to.exist
          expect(updated).to.be.undefined
          sinon.assert.notCalled(this.UserUpdater.updateUser)
          done()
        }
      )
    })
    it('should remove affiliationUnchecked flag if v1 does not return an error', function(done) {
      this.addAffiliation.yields()
      this.UserUpdater.addAffiliationForNewUser(
        this.stubbedUser._id,
        this.newEmail,
        error => {
          should.not.exist(error)
          sinon.assert.calledOnce(this.UserUpdater.updateUser)
          sinon.assert.calledWithMatch(
            this.UserUpdater.updateUser,
            { _id: this.stubbedUser._id, 'emails.email': this.newEmail },
            { $unset: { 'emails.$.affiliationUnchecked': 1 } }
          )
          done()
        }
      )
    })
  })

  describe('changeEmailAddress', function() {
    beforeEach(function() {
      this.UserGetter.getUserEmail.callsArgWith(1, null, this.stubbedUser.email)
      this.UserUpdater.addEmailAddress = sinon.stub().callsArgWith(2)
      this.UserUpdater.setDefaultEmailAddress = sinon.stub().yields()
      this.UserUpdater.removeEmailAddress = sinon.stub().callsArgWith(2)
    })

    it('change email', function(done) {
      this.UserUpdater.changeEmailAddress(
        this.stubbedUser._id,
        this.newEmail,
        err => {
          should.not.exist(err)
          this.UserUpdater.addEmailAddress
            .calledWith(this.stubbedUser._id, this.newEmail)
            .should.equal(true)
          this.UserUpdater.setDefaultEmailAddress
            .calledWith(this.stubbedUser._id, this.newEmail, true)
            .should.equal(true)
          this.UserUpdater.removeEmailAddress
            .calledWith(this.stubbedUser._id, this.stubbedUser.email)
            .should.equal(true)
          done()
        }
      )
    })

    it('validates email', function(done) {
      this.UserUpdater.changeEmailAddress(this.stubbedUser._id, 'foo', err => {
        should.exist(err)
        done()
      })
    })

    it('handle error', function(done) {
      this.UserUpdater.removeEmailAddress.callsArgWith(2, new Error('nope'))
      this.UserUpdater.changeEmailAddress(
        this.stubbedUser._id,
        this.newEmail,
        err => {
          should.exist(err)
          done()
        }
      )
    })
  })

  describe('addEmailAddress', function() {
    beforeEach(function() {
      this.UserGetter.ensureUniqueEmailAddress = sinon.stub().callsArgWith(1)
      this.UserUpdater.updateUser = sinon.stub().callsArgWith(2, null)
    })

    it('add email', function(done) {
      this.UserUpdater.addEmailAddress(
        this.stubbedUser._id,
        this.newEmail,
        err => {
          this.UserGetter.ensureUniqueEmailAddress.called.should.equal(true)
          should.not.exist(err)
          const reversedHostname = this.newEmail
            .split('@')[1]
            .split('')
            .reverse()
            .join('')
          this.UserUpdater.updateUser
            .calledWith(this.stubbedUser._id, {
              $push: {
                emails: {
                  email: this.newEmail,
                  createdAt: sinon.match.date,
                  reversedHostname
                }
              }
            })
            .should.equal(true)
          done()
        }
      )
    })

    it('add affiliation', function(done) {
      const affiliationOptions = {
        university: { id: 1 },
        role: 'Prof',
        department: 'Math'
      }
      this.UserUpdater.addEmailAddress(
        this.stubbedUser._id,
        this.newEmail,
        affiliationOptions,
        err => {
          should.not.exist(err)
          this.addAffiliation.calledOnce.should.equal(true)
          const { args } = this.addAffiliation.lastCall
          args[0].should.equal(this.stubbedUser._id)
          args[1].should.equal(this.newEmail)
          args[2].should.equal(affiliationOptions)
          done()
        }
      )
    })

    it('handle affiliation error', function(done) {
      this.addAffiliation.callsArgWith(3, new Error('nope'))
      this.UserUpdater.addEmailAddress(
        this.stubbedUser._id,
        this.newEmail,
        err => {
          should.exist(err)
          this.UserUpdater.updateUser.called.should.equal(false)
          done()
        }
      )
    })

    it('validates email', function(done) {
      this.UserUpdater.addEmailAddress(this.stubbedUser._id, 'bar', err => {
        should.exist(err)
        done()
      })
    })
  })

  describe('removeEmailAddress', function() {
    beforeEach(function() {
      this.UserUpdater.updateUser = sinon
        .stub()
        .callsArgWith(2, null, { nMatched: 1 })
    })

    it('remove email', function(done) {
      this.UserUpdater.removeEmailAddress(
        this.stubbedUser._id,
        this.newEmail,
        err => {
          should.not.exist(err)
          this.UserUpdater.updateUser
            .calledWith(
              { _id: this.stubbedUser._id, email: { $ne: this.newEmail } },
              { $pull: { emails: { email: this.newEmail } } }
            )
            .should.equal(true)
          done()
        }
      )
    })

    it('remove affiliation', function(done) {
      this.UserUpdater.removeEmailAddress(
        this.stubbedUser._id,
        this.newEmail,
        err => {
          should.not.exist(err)
          this.removeAffiliation.calledOnce.should.equal(true)
          const { args } = this.removeAffiliation.lastCall
          args[0].should.equal(this.stubbedUser._id)
          args[1].should.equal(this.newEmail)
          done()
        }
      )
    })

    it('refresh features', function(done) {
      this.UserUpdater.removeEmailAddress(
        this.stubbedUser._id,
        this.newEmail,
        err => {
          should.not.exist(err)
          sinon.assert.calledWith(this.refreshFeatures, this.stubbedUser._id)
          done()
        }
      )
    })

    it('handle error', function(done) {
      this.UserUpdater.updateUser = sinon
        .stub()
        .callsArgWith(2, new Error('nope'))

      this.UserUpdater.removeEmailAddress(
        this.stubbedUser._id,
        this.newEmail,
        err => {
          should.exist(err)
          done()
        }
      )
    })

    it('handle missed update', function(done) {
      this.UserUpdater.updateUser = sinon.stub().callsArgWith(2, null, { n: 0 })

      this.UserUpdater.removeEmailAddress(
        this.stubbedUser._id,
        this.newEmail,
        err => {
          should.exist(err)
          done()
        }
      )
    })

    it('handle affiliation error', function(done) {
      this.removeAffiliation.callsArgWith(2, new Error('nope'))
      this.UserUpdater.removeEmailAddress(
        this.stubbedUser._id,
        this.newEmail,
        err => {
          should.exist(err)
          this.UserUpdater.updateUser.called.should.equal(false)
          done()
        }
      )
    })

    it('validates email', function(done) {
      this.UserUpdater.removeEmailAddress(this.stubbedUser._id, 'baz', err => {
        should.exist(err)
        done()
      })
    })
  })

  describe('setDefaultEmailAddress', function() {
    beforeEach(function() {
      this.stubbedUser.emails = [
        {
          email: this.newEmail,
          confirmedAt: new Date()
        }
      ]
      this.UserGetter.promises.getUser.resolves(this.stubbedUser)
      this.NewsletterManager.promises.changeEmail.callsArgWith(2, null)
      this.RecurlyWrapper.promises.updateAccountEmailAddress.resolves()
    })

    it('set default', function(done) {
      this.UserUpdater.promises.updateUser = sinon.stub().resolves({ n: 1 })

      this.UserUpdater.setDefaultEmailAddress(
        this.stubbedUser._id,
        this.newEmail,
        false,
        err => {
          should.not.exist(err)
          this.UserUpdater.promises.updateUser
            .calledWith(
              { _id: this.stubbedUser._id, 'emails.email': this.newEmail },
              { $set: { email: this.newEmail } }
            )
            .should.equal(true)
          done()
        }
      )
    })

    it('set changed the email in newsletter', function(done) {
      this.UserUpdater.promises.updateUser = sinon.stub().resolves({ n: 1 })

      this.UserUpdater.setDefaultEmailAddress(
        this.stubbedUser._id,
        this.newEmail,
        false,
        err => {
          should.not.exist(err)
          this.NewsletterManager.promises.changeEmail
            .calledWith(this.stubbedUser, this.newEmail)
            .should.equal(true)
          this.RecurlyWrapper.promises.updateAccountEmailAddress
            .calledWith(this.stubbedUser._id, this.newEmail)
            .should.equal(true)
          done()
        }
      )
    })

    it('handle error', function(done) {
      this.UserUpdater.promises.updateUser = sinon.stub().rejects(Error('nope'))

      this.UserUpdater.setDefaultEmailAddress(
        this.stubbedUser._id,
        this.newEmail,
        false,
        err => {
          should.exist(err)
          done()
        }
      )
    })

    it('handle missed update', function(done) {
      this.UserUpdater.promises.updateUser = sinon.stub().resolves({ n: 0 })

      this.UserUpdater.setDefaultEmailAddress(
        this.stubbedUser._id,
        this.newEmail,
        false,
        err => {
          should.exist(err)
          done()
        }
      )
    })

    it('validates email', function(done) {
      this.UserUpdater.setDefaultEmailAddress(
        this.stubbedUser._id,
        '.edu',
        false,
        err => {
          should.exist(err)
          done()
        }
      )
    })

    describe('when email not confirmed', function() {
      beforeEach(function() {
        this.stubbedUser.emails = [
          {
            email: this.newEmail,
            confirmedAt: null
          }
        ]
        this.UserUpdater.promises.updateUser = sinon.stub()
      })

      it('should callback with error', function() {
        this.UserUpdater.setDefaultEmailAddress(
          this.stubbedUser._id,
          this.newEmail,
          false,
          error => {
            expect(error).to.exist
            expect(error.name).to.equal('UnconfirmedEmailError')
            this.UserUpdater.promises.updateUser.callCount.should.equal(0)
            this.NewsletterManager.promises.changeEmail.callCount.should.equal(
              0
            )
          }
        )
      })
    })

    describe('when email does not belong to user', function() {
      beforeEach(function() {
        this.stubbedUser.emails = []
        this.UserGetter.promises.getUser.resolves(this.stubbedUser)
        this.UserUpdater.promises.updateUser = sinon.stub()
      })

      it('should callback with error', function() {
        this.UserUpdater.setDefaultEmailAddress(
          this.stubbedUser._id,
          this.newEmail,
          false,
          error => {
            expect(error).to.exist
            expect(error.name).to.equal('Error')
            this.UserUpdater.promises.updateUser.callCount.should.equal(0)
            this.NewsletterManager.promises.changeEmail.callCount.should.equal(
              0
            )
          }
        )
      })
    })
  })

  describe('confirmEmail', function() {
    beforeEach(function() {
      this.UserUpdater.updateUser = sinon.stub().callsArgWith(2, null, { n: 1 })
    })

    it('should update the email record', function(done) {
      this.UserUpdater.confirmEmail(
        this.stubbedUser._id,
        this.newEmail,
        err => {
          should.not.exist(err)
          this.UserUpdater.updateUser
            .calledWith(
              { _id: this.stubbedUser._id, 'emails.email': this.newEmail },
              { $set: { 'emails.$.confirmedAt': new Date() } }
            )
            .should.equal(true)
          done()
        }
      )
    })

    it('add affiliation', function(done) {
      this.UserUpdater.confirmEmail(
        this.stubbedUser._id,
        this.newEmail,
        err => {
          should.not.exist(err)
          this.addAffiliation.calledOnce.should.equal(true)
          sinon.assert.calledWith(
            this.addAffiliation,
            this.stubbedUser._id,
            this.newEmail,
            { confirmedAt: new Date() }
          )
          done()
        }
      )
    })

    it('handle error', function(done) {
      this.UserUpdater.updateUser = sinon
        .stub()
        .callsArgWith(2, new Error('nope'))

      this.UserUpdater.confirmEmail(
        this.stubbedUser._id,
        this.newEmail,
        err => {
          should.exist(err)
          done()
        }
      )
    })

    it('handle missed update', function(done) {
      this.UserUpdater.updateUser = sinon.stub().callsArgWith(2, null, { n: 0 })

      this.UserUpdater.confirmEmail(
        this.stubbedUser._id,
        this.newEmail,
        err => {
          should.exist(err)
          done()
        }
      )
    })

    it('validates email', function(done) {
      this.UserUpdater.confirmEmail(this.stubbedUser._id, '@', err => {
        should.exist(err)
        done()
      })
    })

    it('handle affiliation error', function(done) {
      this.addAffiliation.callsArgWith(3, new Error('nope'))
      this.UserUpdater.confirmEmail(
        this.stubbedUser._id,
        this.newEmail,
        err => {
          should.exist(err)
          this.UserUpdater.updateUser.called.should.equal(false)
          done()
        }
      )
    })

    it('refresh features', function(done) {
      this.UserUpdater.confirmEmail(
        this.stubbedUser._id,
        this.newEmail,
        err => {
          should.not.exist(err)
          sinon.assert.calledWith(this.refreshFeatures, this.stubbedUser._id)
          done()
        }
      )
    })
  })
})
