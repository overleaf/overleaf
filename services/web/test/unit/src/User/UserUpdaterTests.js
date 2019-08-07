/* eslint-disable
    max-len,
    no-return-assign,
    no-unused-vars,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const should = require('chai').should()
const SandboxedModule = require('sandboxed-module')
const assert = require('assert')
const path = require('path')
const sinon = require('sinon')
const modulePath = path.join(
  __dirname,
  '../../../../app/src/Features/User/UserUpdater'
)
const { expect } = require('chai')
const tk = require('timekeeper')

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
      ensureUniqueEmailAddress: sinon.stub()
    }
    this.logger = {
      err: sinon.stub(),
      log() {},
      warn: sinon.stub()
    }
    this.addAffiliation = sinon.stub().yields()
    this.removeAffiliation = sinon.stub().callsArgWith(2, null)
    this.refreshFeatures = sinon.stub().yields()
    this.NewsletterManager = { changeEmail: sinon.stub() }
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
        '../Subscription/FeaturesUpdater': {
          refreshFeatures: this.refreshFeatures
        },
        'settings-sharelatex': (this.settings = {}),
        request: (this.request = {}),
        '../Newsletter/NewsletterManager': this.NewsletterManager
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

  describe('changeEmailAddress', function() {
    beforeEach(function() {
      this.UserGetter.getUserEmail.callsArgWith(1, null, this.stubbedUser.email)
      this.UserUpdater.addEmailAddress = sinon.stub().callsArgWith(2)
      this.UserUpdater.setDefaultEmailAddress = sinon.stub().yields()
      return (this.UserUpdater.removeEmailAddress = sinon
        .stub()
        .callsArgWith(2))
    })

    it('change email', function(done) {
      return this.UserUpdater.changeEmailAddress(
        this.stubbedUser._id,
        this.newEmail,
        err => {
          should.not.exist(err)
          this.UserUpdater.addEmailAddress
            .calledWith(this.stubbedUser._id, this.newEmail)
            .should.equal(true)
          this.UserUpdater.setDefaultEmailAddress
            .calledWith(this.stubbedUser._id, this.newEmail)
            .should.equal(true)
          this.UserUpdater.removeEmailAddress
            .calledWith(this.stubbedUser._id, this.stubbedUser.email)
            .should.equal(true)
          return done()
        }
      )
    })

    it('validates email', function(done) {
      return this.UserUpdater.changeEmailAddress(
        this.stubbedUser._id,
        'foo',
        err => {
          should.exist(err)
          return done()
        }
      )
    })

    it('handle error', function(done) {
      this.UserUpdater.removeEmailAddress.callsArgWith(2, new Error('nope'))
      return this.UserUpdater.changeEmailAddress(
        this.stubbedUser._id,
        this.newEmail,
        err => {
          should.exist(err)
          return done()
        }
      )
    })
  })

  describe('addEmailAddress', function() {
    beforeEach(function() {
      this.UserGetter.ensureUniqueEmailAddress = sinon.stub().callsArgWith(1)
      return (this.UserUpdater.updateUser = sinon.stub().callsArgWith(2, null))
    })

    it('add email', function(done) {
      return this.UserUpdater.addEmailAddress(
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
          return done()
        }
      )
    })

    it('add affiliation', function(done) {
      const affiliationOptions = {
        university: { id: 1 },
        role: 'Prof',
        department: 'Math'
      }
      return this.UserUpdater.addEmailAddress(
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
          return done()
        }
      )
    })

    it('handle error', function(done) {
      this.UserUpdater.updateUser = sinon
        .stub()
        .callsArgWith(2, new Error('nope'))

      return this.UserUpdater.addEmailAddress(
        this.stubbedUser._id,
        this.newEmail,
        err => {
          this.logger.warn.called.should.equal(true)
          should.exist(err)
          return done()
        }
      )
    })

    it('handle affiliation error', function(done) {
      const body = { errors: 'affiliation error message' }
      this.addAffiliation.callsArgWith(3, new Error('nope'))
      return this.UserUpdater.addEmailAddress(
        this.stubbedUser._id,
        this.newEmail,
        err => {
          should.exist(err)
          this.UserUpdater.updateUser.called.should.equal(false)
          return done()
        }
      )
    })

    it('validates email', function(done) {
      return this.UserUpdater.addEmailAddress(
        this.stubbedUser._id,
        'bar',
        err => {
          should.exist(err)
          return done()
        }
      )
    })
  })

  describe('removeEmailAddress', function() {
    beforeEach(function() {
      return (this.UserUpdater.updateUser = sinon
        .stub()
        .callsArgWith(2, null, { nMatched: 1 }))
    })

    it('remove email', function(done) {
      return this.UserUpdater.removeEmailAddress(
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
          return done()
        }
      )
    })

    it('remove affiliation', function(done) {
      return this.UserUpdater.removeEmailAddress(
        this.stubbedUser._id,
        this.newEmail,
        err => {
          should.not.exist(err)
          this.removeAffiliation.calledOnce.should.equal(true)
          const { args } = this.removeAffiliation.lastCall
          args[0].should.equal(this.stubbedUser._id)
          args[1].should.equal(this.newEmail)
          return done()
        }
      )
    })

    it('handle error', function(done) {
      this.UserUpdater.updateUser = sinon
        .stub()
        .callsArgWith(2, new Error('nope'))

      return this.UserUpdater.removeEmailAddress(
        this.stubbedUser._id,
        this.newEmail,
        err => {
          should.exist(err)
          return done()
        }
      )
    })

    it('handle missed update', function(done) {
      this.UserUpdater.updateUser = sinon.stub().callsArgWith(2, null, { n: 0 })

      return this.UserUpdater.removeEmailAddress(
        this.stubbedUser._id,
        this.newEmail,
        err => {
          should.exist(err)
          return done()
        }
      )
    })

    it('handle affiliation error', function(done) {
      this.removeAffiliation.callsArgWith(2, new Error('nope'))
      return this.UserUpdater.removeEmailAddress(
        this.stubbedUser._id,
        this.newEmail,
        err => {
          should.exist(err)
          this.UserUpdater.updateUser.called.should.equal(false)
          return done()
        }
      )
    })

    it('validates email', function(done) {
      return this.UserUpdater.removeEmailAddress(
        this.stubbedUser._id,
        'baz',
        err => {
          should.exist(err)
          return done()
        }
      )
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
      this.UserGetter.getUser = sinon.stub().yields(null, this.stubbedUser)
      this.NewsletterManager.changeEmail.callsArgWith(2, null)
    })

    it('set default', function(done) {
      this.UserUpdater.updateUser = sinon.stub().callsArgWith(2, null, { n: 1 })

      this.UserUpdater.setDefaultEmailAddress(
        this.stubbedUser._id,
        this.newEmail,
        err => {
          should.not.exist(err)
          this.UserUpdater.updateUser
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
      this.UserUpdater.updateUser = sinon.stub().callsArgWith(2, null, { n: 1 })

      this.UserUpdater.setDefaultEmailAddress(
        this.stubbedUser._id,
        this.newEmail,
        err => {
          should.not.exist(err)
          this.NewsletterManager.changeEmail
            .calledWith(this.stubbedUser.email, this.newEmail)
            .should.equal(true)
          done()
        }
      )
    })

    it('handle error', function(done) {
      this.UserUpdater.updateUser = sinon
        .stub()
        .callsArgWith(2, new Error('nope'))

      this.UserUpdater.setDefaultEmailAddress(
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

      this.UserUpdater.setDefaultEmailAddress(
        this.stubbedUser._id,
        this.newEmail,
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
        this.UserGetter.getUser = sinon.stub().yields(null, this.stubbedUser)
        this.UserUpdater.updateUser = sinon.stub()
        this.NewsletterManager.changeEmail = sinon.stub()
      })

      it('should callback with error', function() {
        this.UserUpdater.setDefaultEmailAddress(
          this.stubbedUser._id,
          this.newEmail,
          this.callback
        )
        this.callback.firstCall.args[0].name.should.equal(
          'UnconfirmedEmailError'
        )
        this.UserUpdater.updateUser.callCount.should.equal(0)
        this.NewsletterManager.changeEmail.callCount.should.equal(0)
      })
    })

    describe('when email does not belong to user', function() {
      beforeEach(function() {
        this.stubbedUser.emails = []
        this.UserGetter.getUser = sinon.stub().yields(null, this.stubbedUser)
        this.UserUpdater.updateUser = sinon.stub()
        this.NewsletterManager.changeEmail = sinon.stub()
      })

      it('should callback with error', function() {
        this.UserUpdater.setDefaultEmailAddress(
          this.stubbedUser._id,
          this.newEmail,
          this.callback
        )
        this.callback.firstCall.args[0].name.should.equal('Error')
        this.UserUpdater.updateUser.callCount.should.equal(0)
        this.NewsletterManager.changeEmail.callCount.should.equal(0)
      })
    })
  })

  describe('confirmEmail', function() {
    beforeEach(function() {
      return (this.UserUpdater.updateUser = sinon
        .stub()
        .callsArgWith(2, null, { n: 1 }))
    })

    it('should update the email record', function(done) {
      return this.UserUpdater.confirmEmail(
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
          return done()
        }
      )
    })

    it('add affiliation', function(done) {
      return this.UserUpdater.confirmEmail(
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
          return done()
        }
      )
    })

    it('handle error', function(done) {
      this.UserUpdater.updateUser = sinon
        .stub()
        .callsArgWith(2, new Error('nope'))

      return this.UserUpdater.confirmEmail(
        this.stubbedUser._id,
        this.newEmail,
        err => {
          should.exist(err)
          return done()
        }
      )
    })

    it('handle missed update', function(done) {
      this.UserUpdater.updateUser = sinon.stub().callsArgWith(2, null, { n: 0 })

      return this.UserUpdater.confirmEmail(
        this.stubbedUser._id,
        this.newEmail,
        err => {
          should.exist(err)
          return done()
        }
      )
    })

    it('validates email', function(done) {
      return this.UserUpdater.confirmEmail(this.stubbedUser._id, '@', err => {
        should.exist(err)
        return done()
      })
    })

    it('handle affiliation error', function(done) {
      this.addAffiliation.callsArgWith(3, new Error('nope'))
      return this.UserUpdater.confirmEmail(
        this.stubbedUser._id,
        this.newEmail,
        err => {
          should.exist(err)
          this.UserUpdater.updateUser.called.should.equal(false)
          return done()
        }
      )
    })

    it('refresh features', function(done) {
      return this.UserUpdater.confirmEmail(
        this.stubbedUser._id,
        this.newEmail,
        err => {
          should.not.exist(err)
          sinon.assert.calledWith(this.refreshFeatures, this.stubbedUser._id)
          return done()
        }
      )
    })
  })
})
