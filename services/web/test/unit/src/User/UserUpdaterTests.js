const { setTimeout } = require('timers/promises')
const SandboxedModule = require('sandboxed-module')
const path = require('path')
const sinon = require('sinon')
const { ObjectId } = require('mongodb-legacy')
const tk = require('timekeeper')
const { expect } = require('chai')
const { normalizeQuery } = require('../../../../app/src/Features/Helpers/Mongo')
const Errors = require('../../../../app/src/Features/Errors/Errors')

const MODULE_PATH = path.join(
  __dirname,
  '../../../../app/src/Features/User/UserUpdater'
)

describe('UserUpdater', function () {
  beforeEach(function () {
    tk.freeze(Date.now())

    this.user = {
      _id: new ObjectId(),
      name: 'bob',
      email: 'hello@world.com',
      emails: [{ email: 'hello@world.com' }],
    }

    this.db = {
      users: {
        updateOne: sinon.stub().resolves({ matchedCount: 1, modifiedCount: 1 }),
      },
    }
    this.mongodb = {
      db: this.db,
      ObjectId,
    }

    this.UserGetter = {
      promises: {
        ensureUniqueEmailAddress: sinon.stub().resolves(),
        getUser: sinon.stub(),
        getUserByMainEmail: sinon.stub(),
        getUserFullEmails: sinon.stub(),
        getUserEmail: sinon.stub(),
      },
    }
    this.UserGetter.promises.getUser.withArgs(this.user._id).resolves(this.user)
    this.UserGetter.promises.getUserByMainEmail
      .withArgs(this.user.email)
      .resolves(this.user)
    this.UserGetter.promises.getUserFullEmails
      .withArgs(this.user._id)
      .resolves(this.user.emails)
    this.UserGetter.promises.getUserEmail
      .withArgs(this.user._id)
      .resolves(this.user.email)

    this.NewsletterManager = {
      promises: {
        changeEmail: sinon.stub().resolves(),
      },
    }
    this.RecurlyWrapper = {
      promises: {
        updateAccountEmailAddress: sinon.stub().resolves(),
      },
    }
    this.AnalyticsManager = {
      recordEventForUserInBackground: sinon.stub(),
    }
    this.InstitutionsAPI = {
      promises: {
        addAffiliation: sinon.stub().resolves(),
        removeAffiliation: sinon.stub().resolves(),
        getUserAffiliations: sinon.stub().resolves(),
      },
    }
    this.EmailHandler = {
      promises: {
        sendEmail: sinon.stub().resolves(),
      },
    }
    this.Features = {
      hasFeature: sinon.stub().returns(false),
    }
    this.FeaturesUpdater = {
      promises: {
        refreshFeatures: sinon.stub().resolves(),
      },
    }
    this.UserAuditLogHandler = {
      promises: {
        addEntry: sinon.stub().resolves(),
      },
    }

    this.SubscriptionLocator = {
      promises: {
        getUserIndividualSubscription: sinon.stub().resolves(),
      },
    }

    this.NotificationsBuilder = {
      promises: {
        redundantPersonalSubscription: sinon
          .stub()
          .returns({ create: () => {} }),
      },
    }

    this.Modules = {
      promises: {
        hooks: {
          fire: sinon.stub().resolves([]),
        },
      },
    }

    this.UserSessionsManager = {
      promises: {
        removeSessionsFromRedis: sinon.stub().resolves(),
      },
    }

    this.UserUpdater = SandboxedModule.require(MODULE_PATH, {
      requires: {
        '../Helpers/Mongo': { normalizeQuery },
        '../../infrastructure/mongodb': this.mongodb,
        './UserGetter': this.UserGetter,
        '../Institutions/InstitutionsAPI': this.InstitutionsAPI,
        '../Email/EmailHandler': this.EmailHandler,
        '../../infrastructure/Features': this.Features,
        '../Subscription/FeaturesUpdater': this.FeaturesUpdater,
        '@overleaf/settings': (this.settings = {}),
        '../Newsletter/NewsletterManager': this.NewsletterManager,
        '../Subscription/RecurlyWrapper': this.RecurlyWrapper,
        './UserAuditLogHandler': this.UserAuditLogHandler,
        '../Analytics/AnalyticsManager': this.AnalyticsManager,
        '../../Errors/Errors': Errors,
        '../Subscription/SubscriptionLocator': this.SubscriptionLocator,
        '../Notifications/NotificationsBuilder': this.NotificationsBuilder,
        '../../infrastructure/Modules': this.Modules,
        './UserSessionsManager': this.UserSessionsManager,
      },
    })

    this.newEmail = 'bob@bob.com'
  })

  afterEach(function () {
    return tk.reset()
  })

  describe('addAffiliationForNewUser', function () {
    it('should not remove affiliationUnchecked flag if v1 returns an error', async function () {
      this.InstitutionsAPI.promises.addAffiliation.rejects()
      await expect(
        this.UserUpdater.promises.addAffiliationForNewUser(
          this.user._id,
          this.newEmail
        )
      ).to.be.rejected
      sinon.assert.notCalled(this.db.users.updateOne)
    })

    it('should remove affiliationUnchecked flag if v1 does not return an error', async function () {
      await this.UserUpdater.promises.addAffiliationForNewUser(
        this.user._id,
        this.newEmail
      )
      sinon.assert.calledOnce(this.db.users.updateOne)
      sinon.assert.calledWithMatch(
        this.db.users.updateOne,
        { _id: this.user._id, 'emails.email': this.newEmail },
        { $unset: { 'emails.$.affiliationUnchecked': 1 } }
      )
    })

    it('should not throw if removing affiliationUnchecked flag errors', async function () {
      this.db.users.updateOne.rejects(new Error('nope'))
      await this.UserUpdater.promises.addAffiliationForNewUser(
        this.user._id,
        this.newEmail
      )
    })
  })

  describe('changeEmailAddress', function () {
    beforeEach(async function () {
      this.auditLog = {
        initiatorId: 'abc123',
        ipAddress: '0:0:0:0',
      }
      // After the email changed, make sure that UserGetter.getUser() returns a
      // user with the new email.
      this.UserGetter.promises.getUser
        .withArgs(this.user._id)
        .onCall(1)
        .resolves({
          ...this.user,
          emails: [...this.user.emails, { email: this.newEmail }],
        })
      // The main email changes as a result of the email change
      this.UserGetter.promises.getUserByMainEmail
        .withArgs(this.user.email)
        .resolves(null)
      this.user.emails.push({ email: this.newEmail })
      await this.UserUpdater.promises.changeEmailAddress(
        this.user._id,
        this.newEmail,
        this.auditLog
      )
    })

    it('adds the new email', function () {
      expect(this.db.users.updateOne).to.have.been.calledWith(
        { _id: this.user._id, 'emails.email': { $ne: this.newEmail } },
        {
          $push: {
            emails: sinon.match({ email: this.newEmail }),
          },
        }
      )
    })

    it('adds the new affiliation', function () {
      this.InstitutionsAPI.promises.addAffiliation.should.have.been.calledWith(
        this.user._id,
        this.newEmail
      )
    })

    it('removes the old email', function () {
      expect(this.db.users.updateOne).to.have.been.calledWith(
        { _id: this.user._id, email: { $ne: this.user.email } },
        { $pull: { emails: { email: this.user.email } } }
      )
    })

    it('removes the affiliation', function () {
      expect(
        this.InstitutionsAPI.promises.removeAffiliation
      ).to.have.been.calledWith(this.user._id, this.user.email)
    })

    it('refreshes features', function () {
      sinon.assert.calledWith(
        this.FeaturesUpdater.promises.refreshFeatures,
        this.user._id
      )
    })

    it('sets the default email', function () {
      expect(this.db.users.updateOne).to.have.been.calledWith(
        { _id: this.user._id, 'emails.email': this.newEmail },
        {
          $set: sinon.match({
            email: this.newEmail,
          }),
        }
      )
    })

    it('sets the new email in the newsletter', function () {
      expect(
        this.NewsletterManager.promises.changeEmail
      ).to.have.been.calledWith(this.user, this.newEmail)
      expect(
        this.RecurlyWrapper.promises.updateAccountEmailAddress
      ).to.have.been.calledWith(this.user._id, this.newEmail)
    })

    it('validates email', async function () {
      await expect(
        this.UserUpdater.promises.changeEmailAddress(
          this.user._id,
          'foo',
          this.auditLog
        )
      ).to.be.rejected
    })
  })

  describe('addEmailAddress', function () {
    it('adds the email', async function () {
      await this.UserUpdater.promises.addEmailAddress(
        this.user._id,
        this.newEmail,
        {},
        { initiatorId: this.user._id, ipAddress: '127:0:0:0' }
      )
      this.UserGetter.promises.ensureUniqueEmailAddress.should.have.been.called
      const reversedHostname = this.newEmail
        .split('@')[1]
        .split('')
        .reverse()
        .join('')
      this.db.users.updateOne.should.have.been.calledWith(
        { _id: this.user._id, 'emails.email': { $ne: this.newEmail } },
        {
          $push: {
            emails: {
              email: this.newEmail,
              createdAt: sinon.match.date,
              reversedHostname,
            },
          },
        }
      )
    })

    it('adds the affiliation', async function () {
      const affiliationOptions = {
        university: { id: 1 },
        role: 'Prof',
        department: 'Math',
      }
      await this.UserUpdater.promises.addEmailAddress(
        this.user._id,
        this.newEmail,
        affiliationOptions,
        { initiatorId: this.user._id, ipAddress: '127:0:0:0' }
      )
      this.InstitutionsAPI.promises.addAffiliation.should.have.been.calledWith(
        this.user._id,
        this.newEmail,
        affiliationOptions
      )
    })

    it('handles affiliation errors', async function () {
      this.InstitutionsAPI.promises.addAffiliation.rejects(new Error('nope'))
      await expect(
        this.UserUpdater.promises.addEmailAddress(
          this.user._id,
          this.newEmail,
          {},
          { initiatorId: this.user._id, ipAddress: '127:0:0:0' }
        )
      ).to.be.rejected
      this.db.users.updateOne.should.not.have.been.called
    })

    it('validates the email', async function () {
      expect(
        this.UserUpdater.promises.addEmailAddress(
          this.user._id,
          'bar',
          {},
          { initiatorId: this.user._id, ipAddress: '127:0:0:0' }
        )
      ).to.be.rejected
    })

    it('updates the audit log', async function () {
      this.ip = '127:0:0:0'
      await this.UserUpdater.promises.addEmailAddress(
        this.user._id,
        this.newEmail,
        {},
        { initiatorId: this.user._id, ipAddress: this.ip }
      )
      this.InstitutionsAPI.promises.addAffiliation.calledOnce.should.equal(true)
      const { args } = this.UserAuditLogHandler.promises.addEntry.lastCall
      expect(args[0]).to.equal(this.user._id)
      expect(args[1]).to.equal('add-email')
      expect(args[2]).to.equal(this.user._id)
      expect(args[3]).to.equal(this.ip)
      expect(args[4]).to.deep.equal({ newSecondaryEmail: this.newEmail })
    })

    describe('errors', function () {
      describe('via UserAuditLogHandler', function () {
        const anError = new Error('oops')
        beforeEach(function () {
          this.UserAuditLogHandler.promises.addEntry.rejects(anError)
        })
        it('should not add email and should return error', async function () {
          await expect(
            this.UserUpdater.promises.addEmailAddress(
              this.user._id,
              this.newEmail,
              {},
              { initiatorId: this.user._id, ipAddress: '127:0:0:0' }
            )
          ).to.be.rejectedWith(anError)
          expect(this.db.users.updateOne).to.not.have.been.called
        })
      })
    })
  })

  describe('removeEmailAddress', function () {
    this.beforeEach(function () {
      this.auditLog = { initiatorId: this.user._id, ipAddress: '127:0:0:0' }
    })
    it('removes the email', async function () {
      await this.UserUpdater.promises.removeEmailAddress(
        this.user._id,
        this.newEmail,
        this.auditLog
      )
      expect(this.db.users.updateOne).to.have.been.calledWith(
        { _id: this.user._id, email: { $ne: this.newEmail } },
        { $pull: { emails: { email: this.newEmail } } }
      )
    })

    it('removes the affiliation', async function () {
      await this.UserUpdater.promises.removeEmailAddress(
        this.user._id,
        this.newEmail,
        this.auditLog
      )
      expect(this.InstitutionsAPI.promises.removeAffiliation).to.have.been
        .calledOnce
      const { args } = this.InstitutionsAPI.promises.removeAffiliation.lastCall
      args[0].should.equal(this.user._id)
      args[1].should.equal(this.newEmail)
    })

    it('refreshes features', async function () {
      await this.UserUpdater.promises.removeEmailAddress(
        this.user._id,
        this.newEmail,
        this.auditLog
      )
      sinon.assert.calledWith(
        this.FeaturesUpdater.promises.refreshFeatures,
        this.user._id
      )
    })

    it('handles Mongo errors', async function () {
      const anError = new Error('nope')
      this.db.users.updateOne.rejects(anError)

      await expect(
        this.UserUpdater.promises.removeEmailAddress(
          this.user._id,
          this.newEmail,
          this.auditLog
        )
      ).to.be.rejected
      expect(this.FeaturesUpdater.promises.refreshFeatures).not.to.have.been
        .called
    })

    it('handles missed update', async function () {
      this.db.users.updateOne.resolves({ matchedCount: 0 })

      await expect(
        this.UserUpdater.promises.removeEmailAddress(
          this.user._id,
          this.newEmail,
          this.auditLog
        )
      ).to.be.rejectedWith('Cannot remove email')
      expect(this.FeaturesUpdater.promises.refreshFeatures).not.to.have.been
        .called
    })

    it('handles an affiliation error', async function () {
      const anError = new Error('nope')
      this.InstitutionsAPI.promises.removeAffiliation.rejects(anError)
      await expect(
        this.UserUpdater.promises.removeEmailAddress(
          this.user._id,
          this.newEmail,
          this.auditLog
        )
      ).to.be.rejected
      expect(this.db.users.updateOne).not.to.have.been.called
      expect(this.FeaturesUpdater.promises.refreshFeatures).not.to.have.been
        .called
    })

    it('throws an error when removing the primary email', async function () {
      await expect(
        this.UserUpdater.promises.removeEmailAddress(
          this.user._id,
          this.user.email,
          this.auditLog
        )
      ).to.be.rejectedWith('cannot remove primary email')
      expect(this.db.users.updateOne).not.to.have.been.called
      expect(this.FeaturesUpdater.promises.refreshFeatures).not.to.have.been
        .called
    })

    it('validates the email', function () {
      expect(
        this.UserUpdater.promises.removeEmailAddress(
          this.user._id,
          'baz',
          this.auditLog
        )
      ).to.be.rejectedWith('invalid email')
    })

    it('skips email validation when skipParseEmail included', async function () {
      const skipParseEmail = true
      await this.UserUpdater.promises.removeEmailAddress(
        this.user._id,
        'baz',
        this.auditLog,
        skipParseEmail
      )
    })

    it('throws an error when skipParseEmail included but email is not a string', async function () {
      const skipParseEmail = true
      await expect(
        this.UserUpdater.promises.removeEmailAddress(
          this.user._id,
          1,
          this.auditLog,
          skipParseEmail
        )
      ).to.be.rejectedWith('email must be a string')
    })

    it('logs the removal to the audit log', async function () {
      await this.UserUpdater.promises.removeEmailAddress(
        this.user._id,
        this.newEmail,
        this.auditLog
      )
      expect(
        this.UserAuditLogHandler.promises.addEntry
      ).to.have.been.calledWith(
        this.user._id,
        'remove-email',
        this.auditLog.initiatorId,
        this.auditLog.ipAddress,
        {
          removedEmail: this.newEmail,
        }
      )
    })

    it('logs the removal from script to the audit log', async function () {
      this.auditLog = {
        initiatorId: undefined,
        ipAddress: '0.0.0.0',
        extraInfo: {
          script: true,
        },
      }
      await this.UserUpdater.promises.removeEmailAddress(
        this.user._id,
        this.newEmail,
        this.auditLog
      )
      expect(
        this.UserAuditLogHandler.promises.addEntry
      ).to.have.been.calledWith(
        this.user._id,
        'remove-email',
        this.auditLog.initiatorId,
        this.auditLog.ipAddress,
        {
          removedEmail: this.newEmail,
          script: true,
        }
      )
    })
  })

  describe('setDefaultEmailAddress', function () {
    function setUserEmails(test, emails) {
      test.user.emails = emails
      test.UserGetter.promises.getUserFullEmails
        .withArgs(test.user._id)
        .resolves(emails)
    }

    beforeEach(function () {
      this.auditLog = {
        initiatorId: this.user,
        ipAddress: '0:0:0:0',
      }
      setUserEmails(this, [
        {
          email: this.newEmail,
          confirmedAt: new Date(),
        },
      ])
    })

    it('set default', async function () {
      await this.UserUpdater.promises.setDefaultEmailAddress(
        this.user._id,
        this.newEmail,
        false,
        this.auditLog
      )
      expect(this.db.users.updateOne).to.have.been.calledWith(
        { _id: this.user._id, 'emails.email': this.newEmail },
        {
          $set: {
            email: this.newEmail,
            lastPrimaryEmailCheck: sinon.match.date,
          },
        }
      )
    })

    it('sets the changed email in the newsletter', async function () {
      await this.UserUpdater.promises.setDefaultEmailAddress(
        this.user._id,
        this.newEmail,
        false,
        this.auditLog
      )
      expect(
        this.NewsletterManager.promises.changeEmail
      ).to.have.been.calledWith(this.user, this.newEmail)
      expect(
        this.RecurlyWrapper.promises.updateAccountEmailAddress
      ).to.have.been.calledWith(this.user._id, this.newEmail)
    })

    it('handles Mongo errors', async function () {
      this.db.users.updateOne = sinon.stub().rejects(Error('nope'))

      await expect(
        this.UserUpdater.promises.setDefaultEmailAddress(
          this.user._id,
          this.newEmail,
          false,
          this.auditLog
        )
      ).to.be.rejected
    })

    it('handles missed updates', async function () {
      this.db.users.updateOne.resolves({ matchedCount: 0 })

      await expect(
        this.UserUpdater.promises.setDefaultEmailAddress(
          this.user._id,
          this.newEmail,
          false,
          this.auditLog
        )
      ).to.be.rejected
    })

    it('validates the email', async function () {
      await expect(
        this.UserUpdater.promises.setDefaultEmailAddress(
          this.user._id,
          '.edu',
          false,
          this.auditLog
        )
      ).to.be.rejected
    })

    it('updates the audit log', async function () {
      await this.UserUpdater.promises.setDefaultEmailAddress(
        this.user._id,
        this.newEmail,
        false,
        this.auditLog
      )
      expect(
        this.UserAuditLogHandler.promises.addEntry
      ).to.have.been.calledWith(
        this.user._id,
        'change-primary-email',
        this.auditLog.initiatorId,
        this.auditLog.ipAddress,
        {
          newPrimaryEmail: this.newEmail,
          oldPrimaryEmail: this.user.email,
        }
      )
    })

    it('blocks email update if audit log returns an error', async function () {
      this.UserAuditLogHandler.promises.addEntry.rejects(new Error('oops'))
      await expect(
        this.UserUpdater.promises.setDefaultEmailAddress(
          this.user._id,
          this.newEmail,
          false,
          this.auditLog
        )
      ).to.be.rejected
      expect(this.db.users.updateOne).to.not.have.been.called
    })

    describe('when email not confirmed', function () {
      beforeEach(function () {
        setUserEmails(this, [
          {
            email: this.newEmail,
            confirmedAt: null,
          },
        ])
      })

      it('should throw an error', async function () {
        await expect(
          this.UserUpdater.promises.setDefaultEmailAddress(
            this.user._id,
            this.newEmail,
            false,
            this.auditLog
          )
        ).to.be.rejectedWith(Errors.UnconfirmedEmailError)
        expect(this.db.users.updateOne).to.not.have.been.called
        expect(this.NewsletterManager.promises.changeEmail).to.not.have.been
          .called
      })
    })

    describe('when email does not belong to user', function () {
      beforeEach(function () {
        setUserEmails(this, [])
        this.UserUpdater.promises.updateUser = sinon.stub()
      })

      it('should callback with error', function () {
        this.UserUpdater.setDefaultEmailAddress(
          this.user._id,
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

    describe('security alert', function () {
      it('should be sent to old and new email when sendSecurityAlert=true', async function () {
        await this.UserUpdater.promises.setDefaultEmailAddress(
          this.user._id,
          this.newEmail,
          false,
          this.auditLog,
          true
        )
        // Emails are sent asynchronously. Wait a bit.
        await setTimeout(100)
        this.EmailHandler.promises.sendEmail.callCount.should.equal(2)
        for (const recipient of [this.user.email, this.newEmail]) {
          expect(this.EmailHandler.promises.sendEmail).to.have.been.calledWith(
            'securityAlert',
            sinon.match({ to: recipient })
          )
        }
      })

      it('should send to the most recently (re-)confirmed emails grouped by institution and by domain for unaffiliated emails', async function () {
        setUserEmails(this, [
          {
            email: '1@a1.uni',
            confirmedAt: new Date(2020, 0, 1),
            reConfirmedAt: new Date(2021, 2, 11),
            lastConfirmedAt: new Date(2021, 2, 11),
            default: false,
            affiliation: {
              institution: {
                id: 123,
                name: 'A1 University',
              },
              cachedConfirmedAt: '2020-01-01T18:25:01.639Z',
              cachedReconfirmedAt: '2021-03-11T18:25:01.639Z',
            },
          },
          {
            email: '2@a1.uni',
            confirmedAt: new Date(2019, 0, 1),
            reConfirmedAt: new Date(2022, 2, 11),
            lastConfirmedAt: new Date(2022, 2, 11),
            default: false,
            affiliation: {
              institution: {
                id: 123,
                name: 'A1 University',
              },
              cachedConfirmedAt: '2019-01-01T18:25:01.639Z',
              cachedReconfirmedAt: '2022-03-11T18:25:01.639Z',
            },
          },
          {
            email: '2020@foo.bar',
            confirmedAt: new Date(2020, 6, 1),
            lastConfirmedAt: new Date(2020, 6, 1),
          },
          {
            email: '2021@foo.bar',
            confirmedAt: new Date(2021, 6, 1),
            lastConfirmedAt: new Date(2021, 6, 1),
          },
          {
            email: this.user.email,
            confirmedAt: new Date(2021, 6, 1),
            lastConfirmedAt: new Date(2021, 6, 1),
          },
          {
            email: this.newEmail,
            confirmedAt: new Date(2021, 6, 1),
            lastConfirmedAt: new Date(2021, 6, 1),
          },
        ])
        await this.UserUpdater.promises.setDefaultEmailAddress(
          this.user._id,
          this.newEmail,
          false,
          this.auditLog,
          true
        )
        // Emails are sent asynchronously. Wait a bit.
        await setTimeout(100)
        this.EmailHandler.promises.sendEmail.callCount.should.equal(4)
        for (const recipient of [
          this.user.email,
          this.newEmail,
          '2@a1.uni',
          '2021@foo.bar',
        ]) {
          expect(this.EmailHandler.promises.sendEmail).to.have.been.calledWith(
            'securityAlert',
            sinon.match({ to: recipient })
          )
        }
      })

      it('should send to the most recently (re-)confirmed emails grouped by institution and by domain for unaffiliated emails (multiple institutions and unaffiliated email domains)', async function () {
        setUserEmails(this, [
          {
            email: '1@a1.uni',
            confirmedAt: new Date(2020, 0, 1),
            reConfirmedAt: new Date(2021, 2, 11),
            lastConfirmedAt: new Date(2021, 2, 11),
            default: false,
            affiliation: {
              institution: {
                id: 123,
                name: 'A1 University',
              },
              cachedConfirmedAt: '2020-01-01T18:25:01.639Z',
              cachedReconfirmedAt: '2021-03-11T18:25:01.639Z',
            },
          },
          {
            email: '1@b2.uni',
            confirmedAt: new Date(2019, 0, 1),
            reConfirmedAt: new Date(2022, 2, 11),
            lastConfirmedAt: new Date(2022, 2, 11),
            default: false,
            affiliation: {
              institution: {
                id: 234,
                name: 'B2 University',
              },
              cachedConfirmedAt: '2019-01-01T18:25:01.639Z',
              cachedReconfirmedAt: '2022-03-11T18:25:01.639Z',
            },
          },
          {
            email: '2020@foo.bar',
            confirmedAt: new Date(2020, 6, 1),
            lastConfirmedAt: new Date(2020, 6, 1),
          },
          {
            email: '2021@bar.foo',
            confirmedAt: new Date(2021, 6, 1),
            lastConfirmedAt: new Date(2021, 6, 1),
          },
          {
            email: this.user.email,
            confirmedAt: new Date(2021, 6, 1),
            lastConfirmedAt: new Date(2021, 6, 1),
          },
          {
            email: this.newEmail,
            confirmedAt: new Date(2021, 6, 1),
            lastConfirmedAt: new Date(2021, 6, 1),
          },
        ])
        await this.UserUpdater.promises.setDefaultEmailAddress(
          this.user._id,
          this.newEmail,
          false,
          this.auditLog,
          true
        )
        // Emails are sent asynchronously. Wait a bit.
        await setTimeout(100)
        this.EmailHandler.promises.sendEmail.callCount.should.equal(6)
        for (const recipient of [
          this.user.email,
          this.newEmail,
          '1@a1.uni',
          '1@b2.uni',
          '2020@foo.bar',
          '2021@bar.foo',
        ]) {
          expect(this.EmailHandler.promises.sendEmail).to.have.been.calledWith(
            'securityAlert',
            sinon.match({ to: recipient })
          )
        }
      })

      describe('errors', function () {
        const anError = new Error('oops')
        describe('EmailHandler', function () {
          beforeEach(function () {
            this.EmailHandler.promises.sendEmail.rejects(anError)
          })
          it('should log but not pass back the error', async function () {
            await this.UserUpdater.promises.setDefaultEmailAddress(
              this.user._id,
              this.newEmail,
              false,
              this.auditLog,
              true
            )
            const loggerCall = this.logger.error.firstCall
            expect(loggerCall.args[0]).to.deep.equal({
              error: anError,
              userId: this.user._id,
            })
            expect(loggerCall.args[1]).to.contain(
              'could not send security alert email when primary email changed'
            )
          })
        })
      })
    })
  })

  describe('confirmEmail', function () {
    it('should update the email record', async function () {
      await this.UserUpdater.promises.confirmEmail(
        this.user._id,
        this.user.email
      )
      expect(this.db.users.updateOne).to.have.been.calledWith(
        {
          _id: this.user._id,
          'emails.email': this.user.email,
        },
        {
          $set: {
            'emails.$.reconfirmedAt': new Date(),
          },
          $min: {
            'emails.$.confirmedAt': new Date(),
          },
        }
      )
    })

    it('adds affiliation', async function () {
      await this.UserUpdater.promises.confirmEmail(this.user._id, this.newEmail)
      this.InstitutionsAPI.promises.addAffiliation.calledOnce.should.equal(true)
      sinon.assert.calledWith(
        this.InstitutionsAPI.promises.addAffiliation,
        this.user._id,
        this.newEmail,
        { confirmedAt: new Date() }
      )
    })

    it('handles errors', async function () {
      this.db.users.updateOne.rejects(new Error('nope'))

      await expect(
        this.UserUpdater.promises.confirmEmail(this.user._id, this.newEmail)
      ).to.be.rejected
    })

    it('handle missed update', async function () {
      this.db.users.updateOne.resolves({ matchedCount: 0 })

      await expect(
        this.UserUpdater.promises.confirmEmail(this.user._id, this.newEmail)
      ).to.be.rejected
    })

    it('validates email', async function () {
      expect(this.UserUpdater.promises.confirmEmail(this.user._id, '@')).to.be
        .rejected
    })

    it('handles affiliation errors', async function () {
      this.InstitutionsAPI.promises.addAffiliation.rejects(new Error('nope'))
      await expect(
        this.UserUpdater.promises.confirmEmail(this.user._id, this.newEmail)
      ).to.be.rejected
      expect(this.db.users.updateOne).to.not.have.been.called
    })

    it('refreshes features', async function () {
      await this.UserUpdater.promises.confirmEmail(this.user._id, this.newEmail)
      sinon.assert.calledWith(
        this.FeaturesUpdater.promises.refreshFeatures,
        this.user._id
      )
    })

    it('should not call redundantPersonalSubscription when user is not on a commons license', async function () {
      this.InstitutionsAPI.promises.getUserAffiliations.resolves([])
      this.SubscriptionLocator.promises.getUserIndividualSubscription.resolves({
        planCode: 'personal',
        groupPlan: false,
      })
      await this.UserUpdater.promises.confirmEmail(this.user._id, this.newEmail)
      sinon.assert.notCalled(
        this.NotificationsBuilder.promises.redundantPersonalSubscription
      )
    })

    describe('with institution licence and subscription', function () {
      beforeEach(async function () {
        this.affiliation = {
          email: this.newEmail,
          licence: 'pro_plus',
          institution: {
            id: 123,
            name: 'Institution',
          },
        }
        this.InstitutionsAPI.promises.getUserAffiliations.resolves([
          this.affiliation,
          { email: 'other@email.edu' },
        ])
        this.SubscriptionLocator.promises.getUserIndividualSubscription.resolves(
          {
            planCode: 'personal',
            groupPlan: false,
          }
        )
      })

      it('creates redundant subscription notification', async function () {
        await this.UserUpdater.promises.confirmEmail(
          this.user._id,
          this.newEmail
        )
        sinon.assert.calledWith(
          this.InstitutionsAPI.promises.getUserAffiliations,
          this.user._id
        )
        sinon.assert.calledWith(
          this.SubscriptionLocator.promises.getUserIndividualSubscription,
          this.user._id
        )
        sinon.assert.calledWith(
          this.NotificationsBuilder.promises.redundantPersonalSubscription,
          {
            institutionId: 123,
            institutionName: 'Institution',
          },
          { _id: this.user._id }
        )
      })
    })
  })

  describe('suspendUser', function () {
    beforeEach(function () {
      this.auditLog = {
        initiatorId: 'abc123',
        ip: '0.0.0.0',
      }
    })

    it('should suspend the user', async function () {
      await this.UserUpdater.promises.suspendUser(this.user._id, this.auditLog)
      expect(this.db.users.updateOne).to.have.been.calledWith(
        { _id: this.user._id, suspended: { $ne: true } },
        { $set: { suspended: true } }
      )
    })

    it('should remove sessions from redis', async function () {
      await this.UserUpdater.promises.suspendUser(this.user._id, this.auditLog)
      expect(
        this.UserSessionsManager.promises.removeSessionsFromRedis
      ).to.have.been.calledWith({ _id: this.user._id })
    })

    it('should log the suspension to the audit log', async function () {
      await this.UserUpdater.promises.suspendUser(this.user._id, this.auditLog)
      expect(
        this.UserAuditLogHandler.promises.addEntry
      ).to.have.been.calledWith(
        this.user._id,
        'account-suspension',
        this.auditLog.initiatorId,
        this.auditLog.ip,
        {}
      )
    })

    it('should fire the removeDropbox hook', async function () {
      await this.UserUpdater.promises.suspendUser(this.user._id, this.auditLog)
      expect(this.Modules.promises.hooks.fire).to.have.been.calledWith(
        'removeDropbox',
        this.user._id,
        'account-suspension'
      )
    })

    it('should handle not finding a record to update', async function () {
      this.db.users.updateOne.resolves({ matchedCount: 0 })
      await expect(
        this.UserUpdater.promises.suspendUser(this.user._id, this.auditLog)
      ).to.be.rejectedWith(Errors.NotFoundError)
    })
  })
})
