import { vi, expect } from 'vitest'
import { setTimeout } from 'node:timers/promises'
import path from 'node:path'
import sinon from 'sinon'
import mongodb from 'mongodb-legacy'
import tk from 'timekeeper'
import MongoHelpers from '../../../../app/src/Features/Helpers/Mongo.mjs'
import Errors from '../../../../app/src/Features/Errors/Errors.js'

const { normalizeQuery } = MongoHelpers
const { ObjectId } = mongodb

const MODULE_PATH = path.join(
  import.meta.dirname,
  '../../../../app/src/Features/User/UserUpdater'
)

vi.mock('../../../../app/src/Features/Errors/Errors.js', () =>
  vi.importActual('../../../../app/src/Features/Errors/Errors.js')
)

describe('UserUpdater', function () {
  beforeEach(async function (ctx) {
    tk.freeze(Date.now())

    ctx.user = {
      _id: new ObjectId(),
      name: 'bob',
      email: 'hello@world.com',
      emails: [{ email: 'hello@world.com' }],
    }

    ctx.db = {
      users: {
        updateOne: sinon.stub().resolves({ matchedCount: 1, modifiedCount: 1 }),
      },
    }
    ctx.mongodb = {
      db: ctx.db,
      ObjectId,
    }

    ctx.UserGetter = {
      promises: {
        ensureUniqueEmailAddress: sinon.stub().resolves(),
        getUser: sinon.stub(),
        getUserByMainEmail: sinon.stub(),
        getUserFullEmails: sinon.stub(),
        getUserEmail: sinon.stub(),
      },
    }
    ctx.UserGetter.promises.getUser.withArgs(ctx.user._id).resolves(ctx.user)
    ctx.UserGetter.promises.getUserByMainEmail
      .withArgs(ctx.user.email)
      .resolves(ctx.user)
    ctx.UserGetter.promises.getUserFullEmails
      .withArgs(ctx.user._id)
      .resolves(ctx.user.emails)
    ctx.UserGetter.promises.getUserEmail
      .withArgs(ctx.user._id)
      .resolves(ctx.user.email)

    ctx.NewsletterManager = {
      promises: {
        changeEmail: sinon.stub().resolves(),
      },
    }
    ctx.AnalyticsManager = {
      recordEventForUserInBackground: sinon.stub(),
    }
    ctx.InstitutionsAPI = {
      promises: {
        addAffiliation: sinon.stub().resolves(),
        removeAffiliation: sinon.stub().resolves(),
        getUserAffiliations: sinon.stub().resolves(),
      },
    }
    ctx.EmailHandler = {
      promises: {
        sendEmail: sinon.stub().resolves(),
      },
    }
    ctx.Features = {
      hasFeature: sinon.stub().returns(false),
    }
    ctx.FeaturesUpdater = {
      promises: {
        refreshFeatures: sinon.stub().resolves(),
      },
    }
    ctx.UserAuditLogHandler = {
      promises: {
        addEntry: sinon.stub().resolves(),
      },
    }

    ctx.SubscriptionLocator = {
      promises: {
        getUserIndividualSubscription: sinon.stub().resolves(),
      },
    }

    ctx.NotificationsBuilder = {
      promises: {
        redundantPersonalSubscription: sinon
          .stub()
          .returns({ create: () => {} }),
      },
    }

    ctx.Modules = {
      promises: {
        hooks: {
          fire: sinon.stub().resolves([]),
        },
      },
    }

    ctx.UserSessionsManager = {
      promises: {
        removeSessionsFromRedis: sinon.stub().resolves(),
      },
    }

    ctx.AsyncLocalStorage = {
      removeItem: sinon.stub(),
    }

    vi.doMock('../../../../app/src/Features/Helpers/Mongo', () => ({
      default: { normalizeQuery },
    }))

    vi.doMock('../../../../app/src/infrastructure/mongodb', () => ctx.mongodb)

    vi.doMock('../../../../app/src/Features/User/UserGetter', () => ({
      default: ctx.UserGetter,
    }))

    vi.doMock(
      '../../../../app/src/Features/Institutions/InstitutionsAPI',
      () => ({
        default: ctx.InstitutionsAPI,
      })
    )

    vi.doMock('../../../../app/src/Features/Email/EmailHandler', () => ({
      default: ctx.EmailHandler,
    }))

    vi.doMock('../../../../app/src/infrastructure/Features', () => ({
      default: ctx.Features,
    }))

    vi.doMock(
      '../../../../app/src/Features/Subscription/FeaturesUpdater',
      () => ({
        default: ctx.FeaturesUpdater,
      })
    )

    vi.doMock('@overleaf/settings', () => ({
      default: (ctx.settings = {}),
    }))

    vi.doMock(
      '../../../../app/src/Features/Newsletter/NewsletterManager',
      () => ({
        default: ctx.NewsletterManager,
      })
    )

    vi.doMock(
      '../../../../app/src/Features/Subscription/RecurlyWrapper',
      () => ({
        default: ctx.RecurlyWrapper,
      })
    )

    vi.doMock('../../../../app/src/Features/User/UserAuditLogHandler', () => ({
      default: ctx.UserAuditLogHandler,
    }))

    vi.doMock(
      '../../../../app/src/Features/Analytics/AnalyticsManager',
      () => ({
        default: ctx.AnalyticsManager,
      })
    )

    vi.doMock(
      '../../../../app/src/Features/Subscription/SubscriptionLocator',
      () => ({
        default: ctx.SubscriptionLocator,
      })
    )

    vi.doMock(
      '../../../../app/src/Features/Notifications/NotificationsBuilder',
      () => ({
        default: ctx.NotificationsBuilder,
      })
    )

    vi.doMock('../../../../app/src/infrastructure/Modules', () => ({
      default: ctx.Modules,
    }))

    vi.doMock('../../../../app/src/Features/User/UserSessionsManager', () => ({
      default: ctx.UserSessionsManager,
    }))

    vi.doMock(
      '../../../../app/src/Features/User/ThirdPartyIdentityManager',
      () => ({
        default: ctx.ThirdPartyIdentityManager,
      })
    )

    vi.doMock('../../../../app/src/infrastructure/AsyncLocalStorage', () => ({
      default: ctx.AsyncLocalStorage,
    }))

    ctx.UserUpdater = (await import(MODULE_PATH)).default

    ctx.newEmail = 'bob@bob.com'
  })

  afterEach(function () {
    return tk.reset()
  })

  describe('addAffiliationForNewUser', function () {
    it('should not remove affiliationUnchecked flag if v1 returns an error', async function (ctx) {
      ctx.InstitutionsAPI.promises.addAffiliation.rejects()
      await expect(
        ctx.UserUpdater.promises.addAffiliationForNewUser(
          ctx.user._id,
          ctx.newEmail
        )
      ).to.be.rejected
      sinon.assert.notCalled(ctx.db.users.updateOne)
    })

    it('should remove affiliationUnchecked flag if v1 does not return an error', async function (ctx) {
      await ctx.UserUpdater.promises.addAffiliationForNewUser(
        ctx.user._id,
        ctx.newEmail
      )
      sinon.assert.calledOnce(ctx.db.users.updateOne)
      sinon.assert.calledWithMatch(
        ctx.db.users.updateOne,
        { _id: ctx.user._id, 'emails.email': ctx.newEmail },
        { $unset: { 'emails.$.affiliationUnchecked': 1 } }
      )
    })

    it('should not throw if removing affiliationUnchecked flag errors', async function (ctx) {
      ctx.db.users.updateOne.rejects(new Error('nope'))
      await ctx.UserUpdater.promises.addAffiliationForNewUser(
        ctx.user._id,
        ctx.newEmail
      )
    })

    it('calls to remove userFullEmails from AsyncLocalStorage', async function (ctx) {
      await ctx.UserUpdater.promises.addAffiliationForNewUser(
        ctx.user._id,
        ctx.newEmail
      )
      expect(ctx.AsyncLocalStorage.removeItem).to.have.been.calledWith(
        'userFullEmails'
      )
    })
  })

  describe('changeEmailAddress', function () {
    beforeEach(async function (ctx) {
      ctx.auditLog = {
        initiatorId: 'abc123',
        ipAddress: '0:0:0:0',
      }
      // After the email changed, make sure that UserGetter.getUser() returns a
      // user with the new email.
      ctx.UserGetter.promises.getUser
        .withArgs(ctx.user._id)
        .onCall(1)
        .resolves({
          ...ctx.user,
          emails: [...ctx.user.emails, { email: ctx.newEmail }],
        })
      // The main email changes as a result of the email change
      ctx.UserGetter.promises.getUserByMainEmail
        .withArgs(ctx.user.email)
        .resolves(null)
      ctx.user.emails.push({ email: ctx.newEmail })
      await ctx.UserUpdater.promises.changeEmailAddress(
        ctx.user._id,
        ctx.newEmail,
        ctx.auditLog
      )
    })

    it('adds the new email', function (ctx) {
      expect(ctx.db.users.updateOne).to.have.been.calledWith(
        { _id: ctx.user._id, 'emails.email': { $ne: ctx.newEmail } },
        {
          $push: {
            emails: sinon.match({ email: ctx.newEmail }),
          },
        }
      )
    })

    it('adds the new affiliation', function (ctx) {
      ctx.InstitutionsAPI.promises.addAffiliation.should.have.been.calledWith(
        ctx.user._id,
        ctx.newEmail
      )
    })

    it('removes the old email', function (ctx) {
      expect(ctx.db.users.updateOne).to.have.been.calledWith(
        { _id: ctx.user._id, email: { $ne: ctx.user.email } },
        { $pull: { emails: { email: ctx.user.email } } }
      )
    })

    it('removes the affiliation', function (ctx) {
      expect(
        ctx.InstitutionsAPI.promises.removeAffiliation
      ).to.have.been.calledWith(ctx.user._id, ctx.user.email)
    })

    it('refreshes features', function (ctx) {
      sinon.assert.calledWith(
        ctx.FeaturesUpdater.promises.refreshFeatures,
        ctx.user._id
      )
    })

    it('sets the default email', function (ctx) {
      expect(ctx.db.users.updateOne).to.have.been.calledWith(
        { _id: ctx.user._id, 'emails.email': ctx.newEmail },
        {
          $set: sinon.match({
            email: ctx.newEmail,
          }),
        }
      )
    })

    it('sets the new email in the newsletter', function (ctx) {
      expect(
        ctx.NewsletterManager.promises.changeEmail
      ).to.have.been.calledWith(ctx.user, ctx.newEmail)
      expect(ctx.Modules.promises.hooks.fire).to.have.been.calledWith(
        'updateAccountEmailAddress',
        ctx.user._id,
        ctx.newEmail
      )
    })

    it('validates email', async function (ctx) {
      await expect(
        ctx.UserUpdater.promises.changeEmailAddress(
          ctx.user._id,
          'foo',
          ctx.auditLog
        )
      ).to.be.rejected
    })
  })

  describe('addEmailAddress', function () {
    it('adds the email', async function (ctx) {
      await ctx.UserUpdater.promises.addEmailAddress(
        ctx.user._id,
        ctx.newEmail,
        {},
        { initiatorId: ctx.user._id, ipAddress: '127:0:0:0' }
      )
      ctx.UserGetter.promises.ensureUniqueEmailAddress.should.have.been.called
      const reversedHostname = ctx.newEmail
        .split('@')[1]
        .split('')
        .reverse()
        .join('')
      ctx.db.users.updateOne.should.have.been.calledWith(
        { _id: ctx.user._id, 'emails.email': { $ne: ctx.newEmail } },
        {
          $push: {
            emails: {
              email: ctx.newEmail,
              createdAt: sinon.match.date,
              reversedHostname,
            },
          },
        }
      )
    })

    it('adds the affiliation', async function (ctx) {
      const affiliationOptions = {
        university: { id: 1 },
        role: 'Prof',
        department: 'Math',
      }
      await ctx.UserUpdater.promises.addEmailAddress(
        ctx.user._id,
        ctx.newEmail,
        affiliationOptions,
        { initiatorId: ctx.user._id, ipAddress: '127:0:0:0' }
      )
      ctx.InstitutionsAPI.promises.addAffiliation.should.have.been.calledWith(
        ctx.user._id,
        ctx.newEmail,
        affiliationOptions
      )
    })

    it('handles affiliation errors', async function (ctx) {
      ctx.InstitutionsAPI.promises.addAffiliation.rejects(new Error('nope'))
      await expect(
        ctx.UserUpdater.promises.addEmailAddress(
          ctx.user._id,
          ctx.newEmail,
          {},
          { initiatorId: ctx.user._id, ipAddress: '127:0:0:0' }
        )
      ).to.be.rejected
      ctx.db.users.updateOne.should.not.have.been.called
    })

    it('validates the email', async function (ctx) {
      expect(
        ctx.UserUpdater.promises.addEmailAddress(
          ctx.user._id,
          'bar',
          {},
          { initiatorId: ctx.user._id, ipAddress: '127:0:0:0' }
        )
      ).to.be.rejected
    })

    it('updates the audit log', async function (ctx) {
      ctx.ip = '127:0:0:0'
      await ctx.UserUpdater.promises.addEmailAddress(
        ctx.user._id,
        ctx.newEmail,
        {},
        { initiatorId: ctx.user._id, ipAddress: ctx.ip }
      )
      ctx.InstitutionsAPI.promises.addAffiliation.calledOnce.should.equal(true)
      const { args } = ctx.UserAuditLogHandler.promises.addEntry.lastCall
      expect(args[0]).to.equal(ctx.user._id)
      expect(args[1]).to.equal('add-email')
      expect(args[2]).to.equal(ctx.user._id)
      expect(args[3]).to.equal(ctx.ip)
      expect(args[4]).to.deep.equal({ newSecondaryEmail: ctx.newEmail })
    })

    describe('errors', function () {
      describe('via UserAuditLogHandler', function () {
        const anError = new Error('oops')
        beforeEach(function (ctx) {
          ctx.UserAuditLogHandler.promises.addEntry.rejects(anError)
        })
        it('should not add email and should return error', async function (ctx) {
          await expect(
            ctx.UserUpdater.promises.addEmailAddress(
              ctx.user._id,
              ctx.newEmail,
              {},
              { initiatorId: ctx.user._id, ipAddress: '127:0:0:0' }
            )
          ).to.be.rejectedWith(anError)
          expect(ctx.db.users.updateOne).to.not.have.been.called
        })
      })
    })

    it('calls to remove userFullEmails from AsyncLocalStorage', async function (ctx) {
      await ctx.UserUpdater.promises.addEmailAddress(
        ctx.user._id,
        ctx.newEmail,
        {},
        { initiatorId: ctx.user._id, ipAddress: '127:0:0:0' }
      )
      expect(ctx.AsyncLocalStorage.removeItem).to.have.been.calledWith(
        'userFullEmails'
      )
    })
  })

  describe('removeEmailAddress', function () {
    beforeEach(function (ctx) {
      ctx.auditLog = { initiatorId: ctx.user._id, ipAddress: '127:0:0:0' }
    })
    it('removes the email', async function (ctx) {
      await ctx.UserUpdater.promises.removeEmailAddress(
        ctx.user._id,
        ctx.newEmail,
        ctx.auditLog
      )
      expect(ctx.db.users.updateOne).to.have.been.calledWith(
        { _id: ctx.user._id, email: { $ne: ctx.newEmail } },
        { $pull: { emails: { email: ctx.newEmail } } }
      )
    })

    it('removes the affiliation', async function (ctx) {
      await ctx.UserUpdater.promises.removeEmailAddress(
        ctx.user._id,
        ctx.newEmail,
        ctx.auditLog
      )
      expect(ctx.InstitutionsAPI.promises.removeAffiliation).to.have.been
        .calledOnce
      const { args } = ctx.InstitutionsAPI.promises.removeAffiliation.lastCall
      args[0].should.equal(ctx.user._id)
      args[1].should.equal(ctx.newEmail)
    })

    it('refreshes features', async function (ctx) {
      await ctx.UserUpdater.promises.removeEmailAddress(
        ctx.user._id,
        ctx.newEmail,
        ctx.auditLog
      )
      sinon.assert.calledWith(
        ctx.FeaturesUpdater.promises.refreshFeatures,
        ctx.user._id
      )
    })

    it('handles Mongo errors', async function (ctx) {
      const anError = new Error('nope')
      ctx.db.users.updateOne.rejects(anError)

      await expect(
        ctx.UserUpdater.promises.removeEmailAddress(
          ctx.user._id,
          ctx.newEmail,
          ctx.auditLog
        )
      ).to.be.rejected
      expect(ctx.FeaturesUpdater.promises.refreshFeatures).not.to.have.been
        .called
    })

    it('handles missed update', async function (ctx) {
      ctx.db.users.updateOne.resolves({ matchedCount: 0 })

      await expect(
        ctx.UserUpdater.promises.removeEmailAddress(
          ctx.user._id,
          ctx.newEmail,
          ctx.auditLog
        )
      ).to.be.rejectedWith('Cannot remove email')
      expect(ctx.FeaturesUpdater.promises.refreshFeatures).not.to.have.been
        .called
    })

    it('handles an affiliation error', async function (ctx) {
      const anError = new Error('nope')
      ctx.InstitutionsAPI.promises.removeAffiliation.rejects(anError)
      await expect(
        ctx.UserUpdater.promises.removeEmailAddress(
          ctx.user._id,
          ctx.newEmail,
          ctx.auditLog
        )
      ).to.be.rejected
      expect(ctx.db.users.updateOne).not.to.have.been.called
      expect(ctx.FeaturesUpdater.promises.refreshFeatures).not.to.have.been
        .called
    })

    it('throws an error when removing the primary email', async function (ctx) {
      await expect(
        ctx.UserUpdater.promises.removeEmailAddress(
          ctx.user._id,
          ctx.user.email,
          ctx.auditLog
        )
      ).to.be.rejectedWith('cannot remove primary email')
      expect(ctx.db.users.updateOne).not.to.have.been.called
      expect(ctx.FeaturesUpdater.promises.refreshFeatures).not.to.have.been
        .called
    })

    it('validates the email', function (ctx) {
      expect(
        ctx.UserUpdater.promises.removeEmailAddress(
          ctx.user._id,
          'baz',
          ctx.auditLog
        )
      ).to.be.rejectedWith('invalid email')
    })

    it('skips email validation when skipParseEmail included', async function (ctx) {
      const skipParseEmail = true
      await ctx.UserUpdater.promises.removeEmailAddress(
        ctx.user._id,
        'baz',
        ctx.auditLog,
        skipParseEmail
      )
    })

    it('throws an error when skipParseEmail included but email is not a string', async function (ctx) {
      const skipParseEmail = true
      await expect(
        ctx.UserUpdater.promises.removeEmailAddress(
          ctx.user._id,
          1,
          ctx.auditLog,
          skipParseEmail
        )
      ).to.be.rejectedWith('email must be a string')
    })

    it('logs the removal to the audit log', async function (ctx) {
      await ctx.UserUpdater.promises.removeEmailAddress(
        ctx.user._id,
        ctx.newEmail,
        ctx.auditLog
      )
      expect(ctx.UserAuditLogHandler.promises.addEntry).to.have.been.calledWith(
        ctx.user._id,
        'remove-email',
        ctx.auditLog.initiatorId,
        ctx.auditLog.ipAddress,
        {
          removedEmail: ctx.newEmail,
        }
      )
    })

    it('logs the removal from script to the audit log', async function (ctx) {
      ctx.auditLog = {
        initiatorId: undefined,
        ipAddress: '0.0.0.0',
        extraInfo: {
          script: true,
        },
      }
      await ctx.UserUpdater.promises.removeEmailAddress(
        ctx.user._id,
        ctx.newEmail,
        ctx.auditLog
      )
      expect(ctx.UserAuditLogHandler.promises.addEntry).to.have.been.calledWith(
        ctx.user._id,
        'remove-email',
        ctx.auditLog.initiatorId,
        ctx.auditLog.ipAddress,
        {
          removedEmail: ctx.newEmail,
          script: true,
        }
      )
    })

    it('calls to remove userFullEmails from AsyncLocalStorage', async function (ctx) {
      await ctx.UserUpdater.promises.removeEmailAddress(
        ctx.user._id,
        ctx.newEmail,
        ctx.auditLog
      )
      expect(ctx.AsyncLocalStorage.removeItem).to.have.been.calledWith(
        'userFullEmails'
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

    beforeEach(function (ctx) {
      ctx.auditLog = {
        initiatorId: ctx.user,
        ipAddress: '0:0:0:0',
      }
      setUserEmails(ctx, [
        {
          email: ctx.newEmail,
          confirmedAt: new Date(),
        },
      ])
    })

    it('set default', async function (ctx) {
      await ctx.UserUpdater.promises.setDefaultEmailAddress(
        ctx.user._id,
        ctx.newEmail,
        false,
        ctx.auditLog
      )
      expect(ctx.db.users.updateOne).to.have.been.calledWith(
        { _id: ctx.user._id, 'emails.email': ctx.newEmail },
        {
          $set: {
            email: ctx.newEmail,
            lastPrimaryEmailCheck: sinon.match.date,
          },
        }
      )
    })

    it('sets the changed email in the newsletter', async function (ctx) {
      await ctx.UserUpdater.promises.setDefaultEmailAddress(
        ctx.user._id,
        ctx.newEmail,
        false,
        ctx.auditLog
      )
      expect(
        ctx.NewsletterManager.promises.changeEmail
      ).to.have.been.calledWith(ctx.user, ctx.newEmail)
      expect(ctx.Modules.promises.hooks.fire).to.have.been.calledWith(
        'updateAccountEmailAddress',
        ctx.user._id,
        ctx.newEmail
      )
    })

    it('handles Mongo errors', async function (ctx) {
      ctx.db.users.updateOne = sinon.stub().rejects(Error('nope'))

      await expect(
        ctx.UserUpdater.promises.setDefaultEmailAddress(
          ctx.user._id,
          ctx.newEmail,
          false,
          ctx.auditLog
        )
      ).to.be.rejected
    })

    it('handles missed updates', async function (ctx) {
      ctx.db.users.updateOne.resolves({ matchedCount: 0 })

      await expect(
        ctx.UserUpdater.promises.setDefaultEmailAddress(
          ctx.user._id,
          ctx.newEmail,
          false,
          ctx.auditLog
        )
      ).to.be.rejected
    })

    it('validates the email', async function (ctx) {
      await expect(
        ctx.UserUpdater.promises.setDefaultEmailAddress(
          ctx.user._id,
          '.edu',
          false,
          ctx.auditLog
        )
      ).to.be.rejected
    })

    it('updates the audit log', async function (ctx) {
      await ctx.UserUpdater.promises.setDefaultEmailAddress(
        ctx.user._id,
        ctx.newEmail,
        false,
        ctx.auditLog
      )
      expect(ctx.UserAuditLogHandler.promises.addEntry).to.have.been.calledWith(
        ctx.user._id,
        'change-primary-email',
        ctx.auditLog.initiatorId,
        ctx.auditLog.ipAddress,
        {
          newPrimaryEmail: ctx.newEmail,
          oldPrimaryEmail: ctx.user.email,
        }
      )
    })

    it('blocks email update if audit log returns an error', async function (ctx) {
      ctx.UserAuditLogHandler.promises.addEntry.rejects(new Error('oops'))
      await expect(
        ctx.UserUpdater.promises.setDefaultEmailAddress(
          ctx.user._id,
          ctx.newEmail,
          false,
          ctx.auditLog
        )
      ).to.be.rejected
      expect(ctx.db.users.updateOne).to.not.have.been.called
    })

    it('calls to remove userFullEmails from AsyncLocalStorage', async function (ctx) {
      await ctx.UserUpdater.promises.setDefaultEmailAddress(
        ctx.user._id,
        ctx.newEmail,
        false,
        ctx.auditLog
      )
      expect(ctx.AsyncLocalStorage.removeItem).to.have.been.calledWith(
        'userFullEmails'
      )
    })

    describe('when email not confirmed', function () {
      beforeEach(function (ctx) {
        setUserEmails(ctx, [
          {
            email: ctx.newEmail,
            confirmedAt: null,
          },
        ])
      })

      it('should throw an error', async function (ctx) {
        await expect(
          ctx.UserUpdater.promises.setDefaultEmailAddress(
            ctx.user._id,
            ctx.newEmail,
            false,
            ctx.auditLog
          )
        ).to.be.rejectedWith(Errors.UnconfirmedEmailError)
        expect(ctx.db.users.updateOne).to.not.have.been.called
        expect(ctx.NewsletterManager.promises.changeEmail).to.not.have.been
          .called
      })
    })

    describe('when email does not belong to user', function () {
      beforeEach(function (ctx) {
        setUserEmails(ctx, [])
        ctx.UserUpdater.promises.updateUser = sinon.stub()
      })

      it('should callback with error', function (ctx) {
        ctx.UserUpdater.setDefaultEmailAddress(
          ctx.user._id,
          ctx.newEmail,
          false,
          ctx.auditLog,
          error => {
            expect(error).to.exist
            expect(error.name).to.equal('Error')
            ctx.UserUpdater.promises.updateUser.callCount.should.equal(0)
            ctx.NewsletterManager.promises.changeEmail.callCount.should.equal(0)
          }
        )
      })
    })

    describe('security alert', function () {
      it('should be sent to old and new email when sendSecurityAlert=true', async function (ctx) {
        await ctx.UserUpdater.promises.setDefaultEmailAddress(
          ctx.user._id,
          ctx.newEmail,
          false,
          ctx.auditLog,
          true
        )
        // Emails are sent asynchronously. Wait a bit.
        await setTimeout(100)
        ctx.EmailHandler.promises.sendEmail.callCount.should.equal(2)
        for (const recipient of [ctx.user.email, ctx.newEmail]) {
          expect(ctx.EmailHandler.promises.sendEmail).to.have.been.calledWith(
            'securityAlert',
            sinon.match({ to: recipient })
          )
        }
      })

      it('should send to the most recently (re-)confirmed emails grouped by institution and by domain for unaffiliated emails', async function (ctx) {
        setUserEmails(ctx, [
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
            email: ctx.user.email,
            confirmedAt: new Date(2021, 6, 1),
            lastConfirmedAt: new Date(2021, 6, 1),
          },
          {
            email: ctx.newEmail,
            confirmedAt: new Date(2021, 6, 1),
            lastConfirmedAt: new Date(2021, 6, 1),
          },
        ])
        await ctx.UserUpdater.promises.setDefaultEmailAddress(
          ctx.user._id,
          ctx.newEmail,
          false,
          ctx.auditLog,
          true
        )
        // Emails are sent asynchronously. Wait a bit.
        await setTimeout(100)
        ctx.EmailHandler.promises.sendEmail.callCount.should.equal(4)
        for (const recipient of [
          ctx.user.email,
          ctx.newEmail,
          '2@a1.uni',
          '2021@foo.bar',
        ]) {
          expect(ctx.EmailHandler.promises.sendEmail).to.have.been.calledWith(
            'securityAlert',
            sinon.match({ to: recipient })
          )
        }
      })

      it('should send to the most recently (re-)confirmed emails grouped by institution and by domain for unaffiliated emails (multiple institutions and unaffiliated email domains)', async function (ctx) {
        setUserEmails(ctx, [
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
            email: ctx.user.email,
            confirmedAt: new Date(2021, 6, 1),
            lastConfirmedAt: new Date(2021, 6, 1),
          },
          {
            email: ctx.newEmail,
            confirmedAt: new Date(2021, 6, 1),
            lastConfirmedAt: new Date(2021, 6, 1),
          },
        ])
        await ctx.UserUpdater.promises.setDefaultEmailAddress(
          ctx.user._id,
          ctx.newEmail,
          false,
          ctx.auditLog,
          true
        )
        // Emails are sent asynchronously. Wait a bit.
        await setTimeout(100)
        ctx.EmailHandler.promises.sendEmail.callCount.should.equal(6)
        for (const recipient of [
          ctx.user.email,
          ctx.newEmail,
          '1@a1.uni',
          '1@b2.uni',
          '2020@foo.bar',
          '2021@bar.foo',
        ]) {
          expect(ctx.EmailHandler.promises.sendEmail).to.have.been.calledWith(
            'securityAlert',
            sinon.match({ to: recipient })
          )
        }
      })

      describe('errors', function () {
        const anError = new Error('oops')
        describe('EmailHandler', function () {
          beforeEach(function (ctx) {
            ctx.EmailHandler.promises.sendEmail.rejects(anError)
          })
          it('should log but not pass back the error', async function (ctx) {
            await ctx.UserUpdater.promises.setDefaultEmailAddress(
              ctx.user._id,
              ctx.newEmail,
              false,
              ctx.auditLog,
              true
            )
            const loggerCall = ctx.logger.error.mock.calls[0]
            expect(loggerCall[0]).to.deep.equal({
              error: anError,
              userId: ctx.user._id,
            })
            expect(loggerCall[1]).to.contain(
              'could not send security alert email when primary email changed'
            )
          })
        })
      })
    })
  })

  describe('confirmEmail', function () {
    it('should update the email record', async function (ctx) {
      await ctx.UserUpdater.promises.confirmEmail(ctx.user._id, ctx.user.email)
      expect(ctx.db.users.updateOne).to.have.been.calledWith(
        {
          _id: ctx.user._id,
          'emails.email': ctx.user.email,
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

    it('adds affiliation', async function (ctx) {
      await ctx.UserUpdater.promises.confirmEmail(ctx.user._id, ctx.newEmail)
      ctx.InstitutionsAPI.promises.addAffiliation.calledOnce.should.equal(true)
      sinon.assert.calledWith(
        ctx.InstitutionsAPI.promises.addAffiliation,
        ctx.user._id,
        ctx.newEmail,
        { confirmedAt: new Date() }
      )
    })

    it('handles errors', async function (ctx) {
      ctx.db.users.updateOne.rejects(new Error('nope'))

      await expect(
        ctx.UserUpdater.promises.confirmEmail(ctx.user._id, ctx.newEmail)
      ).to.be.rejected
    })

    it('handle missed update', async function (ctx) {
      ctx.db.users.updateOne.resolves({ matchedCount: 0 })

      await expect(
        ctx.UserUpdater.promises.confirmEmail(ctx.user._id, ctx.newEmail)
      ).to.be.rejected
    })

    it('validates email', async function (ctx) {
      expect(ctx.UserUpdater.promises.confirmEmail(ctx.user._id, '@')).to.be
        .rejected
    })

    it('handles affiliation errors', async function (ctx) {
      ctx.InstitutionsAPI.promises.addAffiliation.rejects(new Error('nope'))
      await expect(
        ctx.UserUpdater.promises.confirmEmail(ctx.user._id, ctx.newEmail)
      ).to.be.rejected
      expect(ctx.db.users.updateOne).to.not.have.been.called
    })

    it('refreshes features', async function (ctx) {
      await ctx.UserUpdater.promises.confirmEmail(ctx.user._id, ctx.newEmail)
      sinon.assert.calledWith(
        ctx.FeaturesUpdater.promises.refreshFeatures,
        ctx.user._id
      )
    })

    it('should not call redundantPersonalSubscription when user is not on a commons license', async function (ctx) {
      ctx.InstitutionsAPI.promises.getUserAffiliations.resolves([])
      ctx.SubscriptionLocator.promises.getUserIndividualSubscription.resolves({
        planCode: 'personal',
        groupPlan: false,
      })
      await ctx.UserUpdater.promises.confirmEmail(ctx.user._id, ctx.newEmail)
      sinon.assert.notCalled(
        ctx.NotificationsBuilder.promises.redundantPersonalSubscription
      )
    })

    it('calls to remove userFullEmails from AsyncLocalStorage', async function (ctx) {
      await ctx.UserUpdater.promises.confirmEmail(ctx.user._id, ctx.newEmail)
      expect(ctx.AsyncLocalStorage.removeItem).to.have.been.called
      expect(ctx.AsyncLocalStorage.removeItem).to.have.been.calledWith(
        'userFullEmails'
      )
    })

    describe('with institution licence and subscription', function () {
      beforeEach(async function (ctx) {
        ctx.affiliation = {
          email: ctx.newEmail,
          licence: 'pro_plus',
          institution: {
            id: 123,
            name: 'Institution',
          },
        }
        ctx.InstitutionsAPI.promises.getUserAffiliations.resolves([
          ctx.affiliation,
          { email: 'other@email.edu' },
        ])
        ctx.SubscriptionLocator.promises.getUserIndividualSubscription.resolves(
          {
            planCode: 'personal',
            groupPlan: false,
          }
        )
      })

      it('creates redundant subscription notification', async function (ctx) {
        await ctx.UserUpdater.promises.confirmEmail(ctx.user._id, ctx.newEmail)
        sinon.assert.calledWith(
          ctx.InstitutionsAPI.promises.getUserAffiliations,
          ctx.user._id
        )
        sinon.assert.calledWith(
          ctx.SubscriptionLocator.promises.getUserIndividualSubscription,
          ctx.user._id
        )
        sinon.assert.calledWith(
          ctx.NotificationsBuilder.promises.redundantPersonalSubscription,
          {
            institutionId: 123,
            institutionName: 'Institution',
          },
          { _id: ctx.user._id }
        )
      })
    })
  })

  describe('suspendUser', function () {
    beforeEach(function (ctx) {
      ctx.auditLog = {
        initiatorId: 'abc123',
        ip: '0.0.0.0',
      }
    })

    it('should suspend the user', async function (ctx) {
      await ctx.UserUpdater.promises.suspendUser(ctx.user._id, ctx.auditLog)
      expect(ctx.db.users.updateOne).to.have.been.calledWith(
        { _id: ctx.user._id, suspended: { $ne: true } },
        { $set: { suspended: true } }
      )
    })

    it('should remove sessions from redis', async function (ctx) {
      await ctx.UserUpdater.promises.suspendUser(ctx.user._id, ctx.auditLog)
      expect(
        ctx.UserSessionsManager.promises.removeSessionsFromRedis
      ).to.have.been.calledWith({ _id: ctx.user._id })
    })

    it('should log the suspension to the audit log', async function (ctx) {
      await ctx.UserUpdater.promises.suspendUser(ctx.user._id, ctx.auditLog)
      expect(ctx.UserAuditLogHandler.promises.addEntry).to.have.been.calledWith(
        ctx.user._id,
        'account-suspension',
        ctx.auditLog.initiatorId,
        ctx.auditLog.ip,
        {}
      )
    })

    it('should fire the removeDropbox hook', async function (ctx) {
      await ctx.UserUpdater.promises.suspendUser(ctx.user._id, ctx.auditLog)
      expect(ctx.Modules.promises.hooks.fire).to.have.been.calledWith(
        'removeDropbox',
        ctx.user._id,
        'account-suspension'
      )
    })

    it('should handle not finding a record to update', async function (ctx) {
      ctx.db.users.updateOne.resolves({ matchedCount: 0 })
      await expect(
        ctx.UserUpdater.promises.suspendUser(ctx.user._id, ctx.auditLog)
      ).to.be.rejectedWith(Errors.NotFoundError)
    })
  })
})
