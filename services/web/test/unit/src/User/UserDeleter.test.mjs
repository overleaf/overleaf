import { beforeEach, describe, expect, vi, it } from 'vitest'
import sinon from 'sinon'
import tk from 'timekeeper'
import moment from 'moment'
import Errors from '../../../../app/src/Features/Errors/Errors.js'
import mongoose from 'mongoose'
import { DeletedUser } from '../../../../app/src/models/DeletedUser.mjs'
import { User } from '../../../../app/src/models/User.mjs'

const ObjectId = mongoose.Types.ObjectId

vi.mock('../../../../app/src/Features/Errors/Errors.js', () =>
  vi.importActual('../../../../app/src/Features/Errors/Errors.js')
)

const modulePath = '../../../../app/src/Features/User/UserDeleter.mjs'

describe('UserDeleter', function () {
  beforeEach(async function (ctx) {
    ctx.userId = new ObjectId()
    ctx.ipAddress = '1.2.3.4'

    ctx.UserMock = sinon.mock(User)
    ctx.DeletedUserMock = sinon.mock(DeletedUser)

    tk.freeze(Date.now())

    ctx.mockedUser = sinon.mock(
      new User({
        _id: ctx.userId,
        email: 'bob@bob.com',
        lastLoggedIn: Date.now() + 1000,
        signUpDate: Date.now() + 2000,
        loginCount: 10,
        overleaf: {
          id: 1234,
        },
        refered_users: ['wombat', 'potato'],
        refered_user_count: 2,
        referal_id: ['giraffe'],
      })
    )
    ctx.user = ctx.mockedUser.object

    ctx.NewsletterManager = {
      promises: {
        unsubscribe: sinon.stub().resolves(),
      },
    }

    ctx.ProjectDeleter = {
      promises: {
        deleteUsersProjects: sinon.stub().resolves(),
      },
    }

    ctx.SubscriptionHandler = {
      promises: {
        cancelSubscription: sinon.stub().resolves(),
      },
    }

    ctx.SubscriptionUpdater = {
      promises: {
        removeUserFromAllGroups: sinon.stub().resolves(),
      },
    }

    ctx.SubscriptionLocator = {
      promises: {
        getUsersSubscription: sinon.stub().resolves(),
        getUniqueManagedSubscriptionMemberOf: sinon.stub().resolves(),
      },
    }

    ctx.UserMembershipsHandler = {
      promises: {
        removeUserFromAllEntities: sinon.stub().resolves(),
      },
    }

    ctx.UserSessionsManager = {
      promises: {
        removeSessionsFromRedis: sinon.stub().resolves(),
      },
    }

    ctx.InstitutionsApi = {
      promises: {
        deleteAffiliations: sinon.stub().resolves(),
      },
    }

    ctx.UserAuditLogEntry = {
      deleteMany: sinon.stub().returns({ exec: sinon.stub().resolves() }),
    }

    ctx.Modules = {
      promises: { hooks: { fire: sinon.stub().resolves() } },
    }

    ctx.OnboardingDataCollectionManager = {
      deleteOnboardingDataCollection: sinon.stub().resolves(),
    }

    ctx.EmailHandler = {
      promises: {
        sendEmail: sinon.stub().resolves(),
      },
    }

    ctx.UserAuditLogHandler = {
      promises: {
        addEntry: sinon.stub().resolves(),
      },
    }

    vi.doMock('../../../../app/src/models/User', () => ({
      User,
    }))

    vi.doMock('../../../../app/src/models/DeletedUser', () => ({
      DeletedUser,
    }))

    vi.doMock(
      '../../../../app/src/Features/Newsletter/NewsletterManager',
      () => ({
        default: ctx.NewsletterManager,
      })
    )

    vi.doMock('../../../../app/src/Features/User/UserSessionsManager', () => ({
      default: ctx.UserSessionsManager,
    }))

    vi.doMock(
      '../../../../app/src/Features/Subscription/SubscriptionHandler',
      () => ({
        default: ctx.SubscriptionHandler,
      })
    )

    vi.doMock(
      '../../../../app/src/Features/Subscription/SubscriptionUpdater',
      () => ({
        default: ctx.SubscriptionUpdater,
      })
    )

    vi.doMock(
      '../../../../app/src/Features/Subscription/SubscriptionLocator',
      () => ({
        default: ctx.SubscriptionLocator,
      })
    )

    vi.doMock(
      '../../../../app/src/Features/UserMembership/UserMembershipsHandler',
      () => ({
        default: ctx.UserMembershipsHandler,
      })
    )

    vi.doMock('../../../../app/src/Features/Project/ProjectDeleter', () => ({
      default: ctx.ProjectDeleter,
    }))

    vi.doMock(
      '../../../../app/src/Features/Institutions/InstitutionsAPI',
      () => ({
        default: ctx.InstitutionsApi,
      })
    )

    vi.doMock('../../../../app/src/models/UserAuditLogEntry', () => ({
      UserAuditLogEntry: ctx.UserAuditLogEntry,
    }))

    vi.doMock('../../../../app/src/Features/User/UserAuditLogHandler', () => ({
      default: ctx.UserAuditLogHandler,
    }))

    vi.doMock('../../../../app/src/infrastructure/Modules', () => ({
      default: ctx.Modules,
    }))

    vi.doMock(
      '../../../../app/src/Features/OnboardingDataCollection/OnboardingDataCollectionManager',
      () => ({
        default: ctx.OnboardingDataCollectionManager,
      })
    )

    vi.doMock('../../../../app/src/Features/Email/EmailHandler', () => ({
      default: ctx.EmailHandler,
    }))

    ctx.UserDeleter = (await import(modulePath)).default
  })

  afterEach(function (ctx) {
    ctx.DeletedUserMock.restore()
    ctx.UserMock.restore()
    ctx.mockedUser.restore()
    tk.reset()
  })

  describe('deleteUser', function () {
    beforeEach(function (ctx) {
      ctx.UserMock.expects('findById')
        .withArgs(ctx.userId)
        .chain('exec')
        .resolves(ctx.user)
    })

    describe('when the user can be deleted', function () {
      beforeEach(function (ctx) {
        ctx.deletedUser = {
          user: ctx.user,
          deleterData: {
            deletedAt: new Date(),
            deletedUserId: ctx.userId,
            deleterIpAddress: ctx.ipAddress,
            deleterId: undefined,
            deletedUserLastLoggedIn: ctx.user.lastLoggedIn,
            deletedUserSignUpDate: ctx.user.signUpDate,
            deletedUserLoginCount: ctx.user.loginCount,
            deletedUserReferralId: ctx.user.referal_id,
            deletedUserReferredUsers: ctx.user.refered_users,
            deletedUserReferredUserCount: ctx.user.refered_user_count,
            deletedUserOverleafId: ctx.user.overleaf.id,
          },
        }
      })

      describe('when only the ip address is passed', function () {
        beforeEach(function (ctx) {
          ctx.DeletedUserMock.expects('updateOne')
            .withArgs(
              { 'deleterData.deletedUserId': ctx.userId },
              ctx.deletedUser,
              { upsert: true }
            )
            .chain('exec')
            .resolves()
        })

        describe('when unsubscribing in Mailchimp succeeds', function () {
          beforeEach(function (ctx) {
            ctx.UserMock.expects('deleteOne')
              .withArgs({ _id: ctx.userId })
              .chain('exec')
              .resolves()
          })

          it('should find and the user in mongo by its id', async function (ctx) {
            await ctx.UserDeleter.promises.deleteUser(ctx.userId, {
              ipAddress: ctx.ipAddress,
            })
            ctx.UserMock.verify()
          })

          it('should delete the user from mailchimp', async function (ctx) {
            await ctx.UserDeleter.promises.deleteUser(ctx.userId, {
              ipAddress: ctx.ipAddress,
            })
            expect(
              ctx.NewsletterManager.promises.unsubscribe
            ).to.have.been.calledWith(ctx.user, { delete: true })
          })

          it('should delete all the projects of a user', async function (ctx) {
            await ctx.UserDeleter.promises.deleteUser(ctx.userId, {
              ipAddress: ctx.ipAddress,
            })
            expect(
              ctx.ProjectDeleter.promises.deleteUsersProjects
            ).to.have.been.calledWith(ctx.userId)
          })

          it("should cancel the user's subscription", async function (ctx) {
            await ctx.UserDeleter.promises.deleteUser(ctx.userId, {
              ipAddress: ctx.ipAddress,
            })
            expect(
              ctx.SubscriptionHandler.promises.cancelSubscription
            ).to.have.been.calledWith(ctx.user)
          })

          it('should delete user affiliations', async function (ctx) {
            await ctx.UserDeleter.promises.deleteUser(ctx.userId, {
              ipAddress: ctx.ipAddress,
            })
            expect(
              ctx.InstitutionsApi.promises.deleteAffiliations
            ).to.have.been.calledWith(ctx.userId)
          })

          it('should cleanup collabratec access tokens', async function (ctx) {
            await ctx.UserDeleter.promises.deleteUser(ctx.userId, {
              ipAddress: ctx.ipAddress,
            })
            expect(ctx.Modules.promises.hooks.fire).to.have.been.calledWith(
              'cleanupPersonalAccessTokens',
              ctx.userId,
              ['collabratec', 'git_bridge']
            )
          })

          it('should fire the deleteUser hook for modules', async function (ctx) {
            await ctx.UserDeleter.promises.deleteUser(ctx.userId, {
              ipAddress: ctx.ipAddress,
            })
            expect(ctx.Modules.promises.hooks.fire).to.have.been.calledWith(
              'deleteUser',
              ctx.userId
            )
          })

          it('should stop the user sessions', async function (ctx) {
            await ctx.UserDeleter.promises.deleteUser(ctx.userId, {
              ipAddress: ctx.ipAddress,
            })
            expect(
              ctx.UserSessionsManager.promises.removeSessionsFromRedis
            ).to.have.been.calledWith(ctx.user)
          })

          it('should remove user from group subscriptions', async function (ctx) {
            await ctx.UserDeleter.promises.deleteUser(ctx.userId, {
              ipAddress: ctx.ipAddress,
            })
            expect(
              ctx.SubscriptionUpdater.promises.removeUserFromAllGroups
            ).to.have.been.calledWith(ctx.userId)
          })

          it('should remove user memberships', async function (ctx) {
            await ctx.UserDeleter.promises.deleteUser(ctx.userId, {
              ipAddress: ctx.ipAddress,
            })
            expect(
              ctx.UserMembershipsHandler.promises.removeUserFromAllEntities
            ).to.have.been.calledWith(ctx.userId)
          })

          it('rejects if the user is a subscription admin', async function (ctx) {
            ctx.SubscriptionLocator.promises.getUsersSubscription.rejects({
              _id: 'some-subscription',
            })
            await expect(ctx.UserDeleter.promises.deleteUser(ctx.userId, {})).to
              .be.rejected
          })

          it('should create a deletedUser', async function (ctx) {
            await ctx.UserDeleter.promises.deleteUser(ctx.userId, {
              ipAddress: ctx.ipAddress,
            })
            ctx.DeletedUserMock.verify()
          })

          describe('email notifications', function () {
            it('should email the user', async function (ctx) {
              await ctx.UserDeleter.promises.deleteUser(ctx.userId, {
                ipAddress: ctx.ipAddress,
              })
              const emailOptions = {
                to: 'bob@bob.com',
                action: 'account deleted',
                actionDescribed: 'your Overleaf account was deleted',
              }
              expect(
                ctx.EmailHandler.promises.sendEmail
              ).to.have.been.calledWith('securityAlert', emailOptions)
            })

            it('should not email the user with skipEmail === true', async function (ctx) {
              await ctx.UserDeleter.promises.deleteUser(ctx.userId, {
                ipAddress: ctx.ipAddress,
                skipEmail: true,
              })
              expect(ctx.EmailHandler.promises.sendEmail).not.to.have.been
                .called
            })

            it('should fail when the email service fails', async function (ctx) {
              ctx.EmailHandler.promises.sendEmail = sinon
                .stub()
                .rejects(new Error('email failed'))
              await expect(
                ctx.UserDeleter.promises.deleteUser(ctx.userId, {
                  ipAddress: ctx.ipAddress,
                })
              ).to.be.rejectedWith('email failed')
            })

            describe('with "force: true" option', function () {
              it('should succeed when the email service fails', async function (ctx) {
                ctx.EmailHandler.promises.sendEmail = sinon
                  .stub()
                  .rejects(new Error('email failed'))
                await expect(
                  ctx.UserDeleter.promises.deleteUser(ctx.userId, {
                    ipAddress: ctx.ipAddress,
                    force: true,
                  })
                ).to.be.fulfilled
              })
            })
          })

          it('should add an audit log entry', async function (ctx) {
            await ctx.UserDeleter.promises.deleteUser(ctx.userId, {
              ipAddress: ctx.ipAddress,
            })
            expect(
              ctx.UserAuditLogHandler.promises.addEntry
            ).to.have.been.calledWith(
              ctx.userId,
              'delete-account',
              ctx.userId,
              ctx.ipAddress,
              {}
            )
          })
        })

        describe('when unsubscribing from mailchimp fails', function () {
          beforeEach(function (ctx) {
            ctx.NewsletterManager.promises.unsubscribe.rejects(
              new Error('something went wrong')
            )
          })

          it('should return an error and not delete the user', async function (ctx) {
            await expect(
              ctx.UserDeleter.promises.deleteUser(ctx.userId, {
                ipAddress: ctx.ipAddress,
              })
            ).to.be.rejected
            ctx.UserMock.verify()
          })
        })

        describe('when called as a callback', function () {
          beforeEach(function (ctx) {
            ctx.UserMock.expects('deleteOne')
              .withArgs({ _id: ctx.userId })
              .chain('exec')
              .resolves()
          })

          it('should delete the user', async function (ctx) {
            await ctx.UserDeleter.promises.deleteUser(ctx.userId, {
              ipAddress: ctx.ipAddress,
            })
            ctx.UserMock.verify()
            ctx.DeletedUserMock.verify()
          })
        })
      })

      describe('when a user and IP address are specified', function () {
        beforeEach(function (ctx) {
          ctx.ipAddress = '1.2.3.4'
          ctx.deleterId = new ObjectId()

          ctx.deletedUser.deleterData.deleterIpAddress = ctx.ipAddress
          ctx.deletedUser.deleterData.deleterId = ctx.deleterId

          ctx.DeletedUserMock.expects('updateOne')
            .withArgs(
              { 'deleterData.deletedUserId': ctx.userId },
              ctx.deletedUser,
              { upsert: true }
            )
            .chain('exec')
            .resolves()
          ctx.UserMock.expects('deleteOne')
            .withArgs({ _id: ctx.userId })
            .chain('exec')
            .resolves()
        })

        it('should add the deleted user id and ip address to the deletedUser', async function (ctx) {
          await ctx.UserDeleter.promises.deleteUser(ctx.userId, {
            deleterUser: { _id: ctx.deleterId },
            ipAddress: ctx.ipAddress,
          })
          ctx.DeletedUserMock.verify()
        })

        it('should add an audit log entry', async function (ctx) {
          await ctx.UserDeleter.promises.deleteUser(ctx.userId, {
            deleterUser: { _id: ctx.deleterId },
            ipAddress: ctx.ipAddress,
          })
          expect(
            ctx.UserAuditLogHandler.promises.addEntry
          ).to.have.been.calledWith(
            ctx.userId,
            'delete-account',
            ctx.deleterId,
            ctx.ipAddress,
            {}
          )
        })

        describe('when called as a callback', function () {
          it('should delete the user', async function (ctx) {
            await ctx.UserDeleter.promises.deleteUser(ctx.userId, {
              deleterUser: { _id: ctx.deleterId },
              ipAddress: ctx.ipAddress,
            })

            ctx.UserMock.verify()
            ctx.DeletedUserMock.verify()
          })
        })
      })

      describe('when the user is part of a managed subscription', function () {
        beforeEach(function (ctx) {
          ctx.managedSubscriptionId = new ObjectId()
          ctx.SubscriptionLocator.promises.getUniqueManagedSubscriptionMemberOf.resolves(
            {
              _id: ctx.managedSubscriptionId,
            }
          )

          ctx.DeletedUserMock.expects('updateOne')
            .withArgs(
              { 'deleterData.deletedUserId': ctx.userId },
              ctx.deletedUser,
              { upsert: true }
            )
            .chain('exec')
            .resolves()
          ctx.UserMock.expects('deleteOne')
            .withArgs({ _id: ctx.userId })
            .chain('exec')
            .resolves()
        })

        it('should include managedSubscriptionId in audit log', async function (ctx) {
          await ctx.UserDeleter.promises.deleteUser(ctx.userId, {
            ipAddress: ctx.ipAddress,
          })
          expect(
            ctx.UserAuditLogHandler.promises.addEntry
          ).to.have.been.calledWith(
            ctx.userId,
            'delete-account',
            ctx.userId,
            ctx.ipAddress,
            {}
          )
        })
      })

      describe('when checking managed subscription fails', function () {
        beforeEach(function (ctx) {
          ctx.SubscriptionLocator.promises.getUniqueManagedSubscriptionMemberOf.rejects(
            new Error('subscription lookup failed')
          )

          ctx.DeletedUserMock.expects('updateOne')
            .withArgs(
              { 'deleterData.deletedUserId': ctx.userId },
              ctx.deletedUser,
              { upsert: true }
            )
            .chain('exec')
            .resolves()
          ctx.UserMock.expects('deleteOne')
            .withArgs({ _id: ctx.userId })
            .chain('exec')
            .resolves()
        })

        it('should continue with deletion and not include managedSubscriptionId', async function (ctx) {
          await ctx.UserDeleter.promises.deleteUser(ctx.userId, {
            ipAddress: ctx.ipAddress,
          })
          expect(
            ctx.UserAuditLogHandler.promises.addEntry
          ).to.have.been.calledWith(
            ctx.userId,
            'delete-account',
            ctx.userId,
            ctx.ipAddress,
            {}
          )
        })
      })
    })

    describe('when the user cannot be deleted because they are a subscription admin', function () {
      beforeEach(function (ctx) {
        ctx.SubscriptionLocator.promises.getUsersSubscription.resolves({
          _id: 'some-subscription',
        })
      })

      it('fails with a SubscriptionAdminDeletionError', async function (ctx) {
        await expect(
          ctx.UserDeleter.promises.deleteUser(ctx.userId)
        ).to.be.rejectedWith(Errors.SubscriptionAdminDeletionError)
      })

      it('should not create a deletedUser', async function (ctx) {
        await expect(ctx.UserDeleter.promises.deleteUser(ctx.userId)).to.be
          .rejected
        ctx.DeletedUserMock.verify()
      })

      it('should not remove the user from mongo', async function (ctx) {
        await expect(ctx.UserDeleter.promises.deleteUser(ctx.userId)).to.be
          .rejected
        ctx.UserMock.verify()
      })
    })
  })

  describe('ensureCanDeleteUser', function () {
    it('should not return error when user can be deleted', async function (ctx) {
      ctx.SubscriptionLocator.promises.getUsersSubscription.resolves(null)
      let error
      try {
        await ctx.UserDeleter.promises.ensureCanDeleteUser(ctx.user)
      } catch (e) {
        error = e
      } finally {
        expect(error).not.to.exist
      }
    })

    it('should return custom error when user is group admin', async function (ctx) {
      ctx.SubscriptionLocator.promises.getUsersSubscription.resolves({
        _id: '123abc',
      })
      let error
      try {
        await ctx.UserDeleter.promises.ensureCanDeleteUser(ctx.user)
      } catch (e) {
        error = e
      } finally {
        expect(error).to.be.instanceof(Errors.SubscriptionAdminDeletionError)
      }
    })

    it('propagates errors', async function (ctx) {
      ctx.SubscriptionLocator.promises.getUsersSubscription.rejects(
        new Error('Some error')
      )
      let error
      try {
        await ctx.UserDeleter.promises.ensureCanDeleteUser(ctx.user)
      } catch (e) {
        error = e
      } finally {
        expect(error).to.be.instanceof(Error)
      }
    })
  })

  describe('expireDeletedUsersAfterDuration', function () {
    const userId1 = new ObjectId()
    const userId2 = new ObjectId()

    beforeEach(function (ctx) {
      ctx.deletedUsers = [
        {
          user: { _id: userId1 },
          deleterData: { deletedUserId: userId1 },
          save: sinon.stub().resolves(),
        },
        {
          user: { _id: userId2 },
          deleterData: { deletedUserId: userId2 },
          save: sinon.stub().resolves(),
        },
      ]

      ctx.DeletedUserMock.expects('find')
        .withArgs({
          'deleterData.deletedAt': {
            $lt: new Date(moment().subtract(90, 'days')),
          },
          user: {
            $type: 'object',
          },
        })
        .chain('exec')
        .resolves(ctx.deletedUsers)
      for (const deletedUser of ctx.deletedUsers) {
        ctx.DeletedUserMock.expects('findOne')
          .withArgs({
            'deleterData.deletedUserId': deletedUser.deleterData.deletedUserId,
          })
          .chain('exec')
          .resolves(deletedUser)
      }
    })

    it('clears data from all deleted users', async function (ctx) {
      await ctx.UserDeleter.promises.expireDeletedUsersAfterDuration()
      for (const deletedUser of ctx.deletedUsers) {
        expect(deletedUser.user).to.be.undefined
        expect(deletedUser.save.called).to.be.true
      }
    })

    it('deletes audit logs for all deleted users', async function (ctx) {
      await ctx.UserDeleter.promises.expireDeletedUsersAfterDuration()
      for (const deletedUser of ctx.deletedUsers) {
        expect(ctx.UserAuditLogEntry.deleteMany).to.have.been.calledWith({
          userId: deletedUser.deleterData.deletedUserId,
        })
      }
    })
  })

  describe('expireDeletedUser', function () {
    beforeEach(function (ctx) {
      ctx.mockedDeletedUser = sinon.mock(
        new DeletedUser({
          user: ctx.user,
          deleterData: {
            deleterIpAddress: '1.1.1.1',
            deletedUserId: ctx.userId,
          },
        })
      )
      ctx.deletedUser = ctx.mockedDeletedUser.object

      ctx.mockedDeletedUser.expects('save').resolves()

      ctx.DeletedUserMock.expects('findOne')
        .withArgs({ 'deleterData.deletedUserId': ctx.userId })
        .chain('exec')
        .resolves(ctx.deletedUser)
    })

    afterEach(function (ctx) {
      ctx.mockedDeletedUser.restore()
    })

    it('should find the user by user ID', async function (ctx) {
      await ctx.UserDeleter.promises.expireDeletedUser(ctx.userId)
      ctx.DeletedUserMock.verify()
    })

    it('should remove the user data from mongo', async function (ctx) {
      await ctx.UserDeleter.promises.expireDeletedUser(ctx.userId)
      expect(ctx.deletedUser.user).not.to.exist
    })

    it('should remove the IP address from mongo', async function (ctx) {
      await ctx.UserDeleter.promises.expireDeletedUser(ctx.userId)
      expect(ctx.deletedUser.deleterData.ipAddress).not.to.exist
    })

    it('should not delete other deleterData fields', async function (ctx) {
      await ctx.UserDeleter.promises.expireDeletedUser(ctx.userId)
      expect(ctx.deletedUser.deleterData.deletedUserId).to.equal(ctx.userId)
    })

    it('should save the record to mongo', async function (ctx) {
      await ctx.UserDeleter.promises.expireDeletedUser(ctx.userId)
      ctx.mockedDeletedUser.verify()
    })

    it('should fire the expireDeletedUser hook for modules', async function (ctx) {
      await ctx.UserDeleter.promises.expireDeletedUser(ctx.userId)
      expect(ctx.Modules.promises.hooks.fire).to.have.been.calledWith(
        'expireDeletedUser',
        ctx.userId
      )
    })

    describe('when called as a callback', function () {
      it('should expire the user', async function (ctx) {
        await new Promise(resolve => {
          ctx.UserDeleter.expireDeletedUser(ctx.userId, err => {
            expect(err).not.to.exist
            ctx.DeletedUserMock.verify()
            ctx.mockedDeletedUser.verify()
            expect(ctx.deletedUser.user).not.to.exist
            expect(ctx.deletedUser.deleterData.ipAddress).not.to.exist
            resolve()
          })
        })
      })
    })
  })
})
