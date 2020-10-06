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
const { normalizeQuery } = require('../../../../app/src/Features/Helpers/Mongo')

describe('UserUpdater', function() {
  beforeEach(function() {
    tk.freeze(Date.now())
    this.mongodb = {
      db: {},
      ObjectId(id) {
        return id
      }
    }
    this.UserGetter = {
      getUserEmail: sinon.stub(),
      getUserByAnyEmail: sinon.stub(),
      promises: {
        ensureUniqueEmailAddress: sinon.stub(),
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
        '../Helpers/Mongo': { normalizeQuery },
        'logger-sharelatex': this.logger,
        '../../infrastructure/mongodb': this.mongodb,
        'metrics-sharelatex': {
          timeAsyncMethod: sinon.stub()
        },
        './UserGetter': this.UserGetter,
        '../Institutions/InstitutionsAPI': (this.InstitutionsAPI = {
          addAffiliation: this.addAffiliation,
          removeAffiliation: this.removeAffiliation,
          promises: {
            addAffiliation: sinon.stub()
          }
        }),
        '../Email/EmailHandler': (this.EmailHandler = {
          promises: {
            sendEmail: sinon.stub()
          }
        }),
        '../../infrastructure/Features': (this.Features = {
          hasFeature: sinon.stub().returns(false)
        }),
        '../Subscription/FeaturesUpdater': {
          refreshFeatures: this.refreshFeatures
        },
        'settings-sharelatex': (this.settings = {}),
        request: (this.request = {}),
        '../Newsletter/NewsletterManager': this.NewsletterManager,
        '../Subscription/RecurlyWrapper': this.RecurlyWrapper,
        './UserAuditLogHandler': (this.UserAuditLogHandler = {
          promises: {
            addEntry: sinon.stub().resolves()
          }
        })
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
      this.auditLog = {
        initiatorId: 'abc123',
        ipAddress: '0:0:0:0'
      }
      this.UserGetter.getUserEmail.callsArgWith(1, null, this.stubbedUser.email)
      this.UserUpdater.addEmailAddress = sinon.stub().callsArgWith(4)
      this.UserUpdater.setDefaultEmailAddress = sinon.stub().yields()
      this.UserUpdater.removeEmailAddress = sinon.stub().callsArgWith(2)
    })

    it('change email', function(done) {
      this.UserUpdater.changeEmailAddress(
        this.stubbedUser._id,
        this.newEmail,
        this.auditLog,
        err => {
          should.not.exist(err)
          this.UserUpdater.addEmailAddress
            .calledWith(this.stubbedUser._id, this.newEmail, {}, this.auditLog)
            .should.equal(true)
          this.UserUpdater.setDefaultEmailAddress
            .calledWith(
              this.stubbedUser._id,
              this.newEmail,
              true,
              this.auditLog,
              true
            )
            .should.equal(true)
          this.UserUpdater.removeEmailAddress
            .calledWith(this.stubbedUser._id, this.stubbedUser.email)
            .should.equal(true)
          done()
        }
      )
    })

    it('validates email', function(done) {
      this.UserUpdater.changeEmailAddress(
        this.stubbedUser._id,
        'foo',
        this.auditLog,
        err => {
          should.exist(err)
          done()
        }
      )
    })

    it('handle error', function(done) {
      this.UserUpdater.removeEmailAddress.callsArgWith(2, new Error('nope'))
      this.UserUpdater.changeEmailAddress(
        this.stubbedUser._id,
        this.newEmail,
        this.auditLog,
        err => {
          should.exist(err)
          done()
        }
      )
    })
  })

  describe('addEmailAddress', function() {
    beforeEach(function() {
      this.UserGetter.promises.ensureUniqueEmailAddress = sinon
        .stub()
        .resolves()
      this.UserUpdater.promises.updateUser = sinon.stub().resolves()
    })

    it('add email', function(done) {
      this.UserUpdater.addEmailAddress(
        this.stubbedUser._id,
        this.newEmail,
        {},
        { initiatorId: this.stubbedUser._id, ipAddress: '127:0:0:0' },
        err => {
          this.UserGetter.promises.ensureUniqueEmailAddress.called.should.equal(
            true
          )
          expect(err).to.not.exist
          const reversedHostname = this.newEmail
            .split('@')[1]
            .split('')
            .reverse()
            .join('')
          this.UserUpdater.promises.updateUser
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
        { initiatorId: this.stubbedUser._id, ipAddress: '127:0:0:0' },
        err => {
          should.not.exist(err)
          this.InstitutionsAPI.promises.addAffiliation.calledOnce.should.equal(
            true
          )
          const { args } = this.InstitutionsAPI.promises.addAffiliation.lastCall
          args[0].should.equal(this.stubbedUser._id)
          args[1].should.equal(this.newEmail)
          args[2].should.equal(affiliationOptions)
          done()
        }
      )
    })

    it('handle affiliation error', function(done) {
      this.InstitutionsAPI.promises.addAffiliation.rejects(new Error('nope'))
      this.UserUpdater.addEmailAddress(
        this.stubbedUser._id,
        this.newEmail,
        {},
        { initiatorId: this.stubbedUser._id, ipAddress: '127:0:0:0' },
        err => {
          should.exist(err)
          this.UserUpdater.promises.updateUser.called.should.equal(false)
          done()
        }
      )
    })

    it('validates email', function(done) {
      this.UserUpdater.addEmailAddress(
        this.stubbedUser._id,
        'bar',
        {},
        { initiatorId: this.stubbedUser._id, ipAddress: '127:0:0:0' },
        err => {
          should.exist(err)
          done()
        }
      )
    })

    it('updates the audit log', function(done) {
      this.ip = '127:0:0:0'
      this.UserUpdater.addEmailAddress(
        this.stubbedUser._id,
        this.newEmail,
        {},
        { initiatorId: this.stubbedUser._id, ipAddress: this.ip },
        error => {
          expect(error).to.not.exist
          this.InstitutionsAPI.promises.addAffiliation.calledOnce.should.equal(
            true
          )
          const { args } = this.UserAuditLogHandler.promises.addEntry.lastCall
          expect(args[0]).to.equal(this.stubbedUser._id)
          expect(args[1]).to.equal('add-email')
          expect(args[2]).to.equal(this.stubbedUser._id)
          expect(args[3]).to.equal(this.ip)
          expect(args[4]).to.deep.equal({
            newSecondaryEmail: this.newEmail
          })
          done()
        }
      )
    })

    describe('errors', function() {
      describe('via UserAuditLogHandler', function() {
        const anError = new Error('oops')
        beforeEach(function() {
          this.UserAuditLogHandler.promises.addEntry.throws(anError)
        })
        it('should not add email and should return error', function(done) {
          this.UserUpdater.addEmailAddress(
            this.stubbedUser._id,
            this.newEmail,
            {},
            { initiatorId: this.stubbedUser._id, ipAddress: '127:0:0:0' },
            error => {
              expect(error).to.exist
              expect(error).to.equal(anError)
              expect(this.UserUpdater.promises.updateUser).to.not.have.been
                .called
              done()
            }
          )
        })
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
      this.auditLog = {
        initiatorId: this.stubbedUser,
        ipAddress: '0:0:0:0'
      }
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
        this.auditLog,
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
        this.auditLog,
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
        this.auditLog,
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
        this.auditLog,
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
        this.auditLog,
        err => {
          should.exist(err)
          done()
        }
      )
    })

    it('updates audit log', function(done) {
      this.UserUpdater.promises.updateUser = sinon.stub().resolves({ n: 1 })

      this.UserUpdater.setDefaultEmailAddress(
        this.stubbedUser._id,
        this.newEmail,
        false,
        this.auditLog,
        error => {
          expect(error).to.not.exist
          expect(
            this.UserAuditLogHandler.promises.addEntry
          ).to.have.been.calledWith(
            this.stubbedUser._id,
            'change-primary-email',
            this.auditLog.initiatorId,
            this.auditLog.ipAddress,
            {
              newPrimaryEmail: this.newEmail,
              oldPrimaryEmail: this.stubbedUser.email
            }
          )
          done()
        }
      )
    })

    it('blocks email update if audit log returns an error', function(done) {
      this.UserUpdater.promises.updateUser = sinon.stub()
      this.UserAuditLogHandler.promises.addEntry.rejects(new Error('oops'))
      this.UserUpdater.setDefaultEmailAddress(
        this.stubbedUser._id,
        this.newEmail,
        false,
        this.auditLog,
        error => {
          expect(error).to.exist
          expect(this.UserUpdater.promises.updateUser).to.not.have.been.called
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
          this.auditLog,
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
          this.auditLog,
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

    describe('security alert', function() {
      it('should be sent to old and new email when sendSecurityAlert=true', function(done) {
        // this.UserGetter.promises.getUser.resolves(this.stubbedUser)
        this.UserUpdater.promises.updateUser = sinon.stub().resolves({ n: 1 })

        this.UserUpdater.setDefaultEmailAddress(
          this.stubbedUser._id,
          this.newEmail,
          false,
          this.auditLog,
          true,
          error => {
            expect(error).to.not.exist
            this.EmailHandler.promises.sendEmail.callCount.should.equal(2)
            const toOldEmailAlert = this.EmailHandler.promises.sendEmail
              .firstCall
            expect(toOldEmailAlert.args[0]).to.equal('securityAlert')
            const toNewEmailAlert = this.EmailHandler.promises.sendEmail
              .lastCall
            expect(toOldEmailAlert.args[1].to).to.equal(this.stubbedUser.email)
            expect(toNewEmailAlert.args[0]).to.equal('securityAlert')
            expect(toNewEmailAlert.args[1].to).to.equal(this.newEmail)
            done()
          }
        )
      })
      describe('errors', function() {
        const anError = new Error('oops')
        describe('EmailHandler', function() {
          beforeEach(function() {
            this.EmailHandler.promises.sendEmail.rejects(anError)
            this.UserUpdater.promises.updateUser = sinon
              .stub()
              .resolves({ n: 1 })
          })
          it('should log but not pass back the error', function(done) {
            this.UserUpdater.setDefaultEmailAddress(
              this.stubbedUser._id,
              this.newEmail,
              false,
              this.auditLog,
              true,
              error => {
                expect(error).to.not.exist
                const loggerCall = this.logger.error.firstCall
                expect(loggerCall.args[0]).to.deep.equal({
                  error: anError,
                  userId: this.stubbedUser._id
                })
                expect(loggerCall.args[1]).to.contain(
                  'could not send security alert email when primary email changed'
                )
                done()
              }
            )
          })
        })
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
