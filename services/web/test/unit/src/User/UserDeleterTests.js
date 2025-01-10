const { expect } = require('chai')
const sinon = require('sinon')
const tk = require('timekeeper')
const moment = require('moment')
const SandboxedModule = require('sandboxed-module')
const Errors = require('../../../../app/src/Features/Errors/Errors')
const ObjectId = require('mongoose').Types.ObjectId
const { User } = require('../helpers/models/User')
const { DeletedUser } = require('../helpers/models/DeletedUser')

const modulePath = '../../../../app/src/Features/User/UserDeleter.js'

describe('UserDeleter', function () {
  beforeEach(function () {
    tk.freeze(Date.now())

    this.userId = new ObjectId()
    this.ipAddress = '1.2.3.4'

    this.UserMock = sinon.mock(User)
    this.DeletedUserMock = sinon.mock(DeletedUser)

    this.mockedUser = sinon.mock(
      new User({
        _id: this.userId,
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
    this.user = this.mockedUser.object

    this.NewsletterManager = {
      promises: {
        unsubscribe: sinon.stub().resolves(),
      },
    }

    this.ProjectDeleter = {
      promises: {
        deleteUsersProjects: sinon.stub().resolves(),
      },
    }

    this.SubscriptionHandler = {
      promises: {
        cancelSubscription: sinon.stub().resolves(),
      },
    }

    this.SubscriptionUpdater = {
      promises: {
        removeUserFromAllGroups: sinon.stub().resolves(),
      },
    }

    this.SubscriptionLocator = {
      promises: {
        getUsersSubscription: sinon.stub().resolves(),
      },
    }

    this.UserMembershipsHandler = {
      promises: {
        removeUserFromAllEntities: sinon.stub().resolves(),
      },
    }

    this.UserSessionsManager = {
      promises: {
        removeSessionsFromRedis: sinon.stub().resolves(),
      },
    }

    this.InstitutionsApi = {
      promises: {
        deleteAffiliations: sinon.stub().resolves(),
      },
    }

    this.UserAuditLogEntry = {
      deleteMany: sinon.stub().returns({ exec: sinon.stub().resolves() }),
    }

    this.Modules = {
      promises: { hooks: { fire: sinon.stub().resolves() } },
    }

    this.Feedback = {
      deleteMany: sinon.stub().returns({ exec: sinon.stub().resolves() }),
    }

    this.OnboardingDataCollectionManager = {
      deleteOnboardingDataCollection: sinon.stub().resolves(),
    }

    this.EmailHandler = {
      promises: {
        sendEmail: sinon.stub().resolves(),
      },
    }

    this.UserAuditLogHandler = {
      promises: {
        addEntry: sinon.stub().resolves(),
      },
    }

    this.UserDeleter = SandboxedModule.require(modulePath, {
      requires: {
        '../../models/User': { User },
        '../../models/DeletedUser': { DeletedUser },
        '../../models/Feedback': { Feedback: this.Feedback },
        '../Newsletter/NewsletterManager': this.NewsletterManager,
        './UserSessionsManager': this.UserSessionsManager,
        '../Subscription/SubscriptionHandler': this.SubscriptionHandler,
        '../Subscription/SubscriptionUpdater': this.SubscriptionUpdater,
        '../Subscription/SubscriptionLocator': this.SubscriptionLocator,
        '../UserMembership/UserMembershipsHandler': this.UserMembershipsHandler,
        '../Project/ProjectDeleter': this.ProjectDeleter,
        '../Institutions/InstitutionsAPI': this.InstitutionsApi,
        '../../models/UserAuditLogEntry': {
          UserAuditLogEntry: this.UserAuditLogEntry,
        },
        './UserAuditLogHandler': this.UserAuditLogHandler,
        '../../infrastructure/Modules': this.Modules,
        '../OnboardingDataCollection/OnboardingDataCollectionManager':
          this.OnboardingDataCollectionManager,
        '../Email/EmailHandler': this.EmailHandler,
      },
    })
  })

  afterEach(function () {
    this.DeletedUserMock.restore()
    this.UserMock.restore()
    this.mockedUser.restore()
    tk.reset()
  })

  describe('deleteUser', function () {
    beforeEach(function () {
      this.UserMock.expects('findById')
        .withArgs(this.userId)
        .chain('exec')
        .resolves(this.user)
    })

    describe('when the user can be deleted', function () {
      beforeEach(function () {
        this.deletedUser = {
          user: this.user,
          deleterData: {
            deletedAt: new Date(),
            deletedUserId: this.userId,
            deleterIpAddress: this.ipAddress,
            deleterId: undefined,
            deletedUserLastLoggedIn: this.user.lastLoggedIn,
            deletedUserSignUpDate: this.user.signUpDate,
            deletedUserLoginCount: this.user.loginCount,
            deletedUserReferralId: this.user.referal_id,
            deletedUserReferredUsers: this.user.refered_users,
            deletedUserReferredUserCount: this.user.refered_user_count,
            deletedUserOverleafId: this.user.overleaf.id,
          },
        }
      })

      describe('when only the ip address is passed', function () {
        beforeEach(function () {
          this.DeletedUserMock.expects('updateOne')
            .withArgs(
              { 'deleterData.deletedUserId': this.userId },
              this.deletedUser,
              { upsert: true }
            )
            .chain('exec')
            .resolves()
        })

        describe('when unsubscribing in Mailchimp succeeds', function () {
          beforeEach(function () {
            this.UserMock.expects('deleteOne')
              .withArgs({ _id: this.userId })
              .chain('exec')
              .resolves()
          })

          it('should find and the user in mongo by its id', async function () {
            await this.UserDeleter.promises.deleteUser(this.userId, {
              ipAddress: this.ipAddress,
            })
            this.UserMock.verify()
          })

          it('should delete the user from mailchimp', async function () {
            await this.UserDeleter.promises.deleteUser(this.userId, {
              ipAddress: this.ipAddress,
            })
            expect(
              this.NewsletterManager.promises.unsubscribe
            ).to.have.been.calledWith(this.user, { delete: true })
          })

          it('should delete all the projects of a user', async function () {
            await this.UserDeleter.promises.deleteUser(this.userId, {
              ipAddress: this.ipAddress,
            })
            expect(
              this.ProjectDeleter.promises.deleteUsersProjects
            ).to.have.been.calledWith(this.userId)
          })

          it("should cancel the user's subscription", async function () {
            await this.UserDeleter.promises.deleteUser(this.userId, {
              ipAddress: this.ipAddress,
            })
            expect(
              this.SubscriptionHandler.promises.cancelSubscription
            ).to.have.been.calledWith(this.user)
          })

          it('should delete user affiliations', async function () {
            await this.UserDeleter.promises.deleteUser(this.userId, {
              ipAddress: this.ipAddress,
            })
            expect(
              this.InstitutionsApi.promises.deleteAffiliations
            ).to.have.been.calledWith(this.userId)
          })

          it('should cleanup collabratec access tokens', async function () {
            await this.UserDeleter.promises.deleteUser(this.userId, {
              ipAddress: this.ipAddress,
            })
            expect(this.Modules.promises.hooks.fire).to.have.been.calledWith(
              'cleanupPersonalAccessTokens',
              this.userId,
              ['collabratec', 'git_bridge']
            )
          })

          it('should fire the deleteUser hook for modules', async function () {
            await this.UserDeleter.promises.deleteUser(this.userId, {
              ipAddress: this.ipAddress,
            })
            expect(this.Modules.promises.hooks.fire).to.have.been.calledWith(
              'deleteUser',
              this.userId
            )
          })

          it('should stop the user sessions', async function () {
            await this.UserDeleter.promises.deleteUser(this.userId, {
              ipAddress: this.ipAddress,
            })
            expect(
              this.UserSessionsManager.promises.removeSessionsFromRedis
            ).to.have.been.calledWith(this.user)
          })

          it('should remove user from group subscriptions', async function () {
            await this.UserDeleter.promises.deleteUser(this.userId, {
              ipAddress: this.ipAddress,
            })
            expect(
              this.SubscriptionUpdater.promises.removeUserFromAllGroups
            ).to.have.been.calledWith(this.userId)
          })

          it('should remove user memberships', async function () {
            await this.UserDeleter.promises.deleteUser(this.userId, {
              ipAddress: this.ipAddress,
            })
            expect(
              this.UserMembershipsHandler.promises.removeUserFromAllEntities
            ).to.have.been.calledWith(this.userId)
          })

          it('rejects if the user is a subscription admin', async function () {
            this.SubscriptionLocator.promises.getUsersSubscription.rejects({
              _id: 'some-subscription',
            })
            await expect(this.UserDeleter.promises.deleteUser(this.userId, {}))
              .to.be.rejected
          })

          it('should create a deletedUser', async function () {
            await this.UserDeleter.promises.deleteUser(this.userId, {
              ipAddress: this.ipAddress,
            })
            this.DeletedUserMock.verify()
          })

          describe('email notifications', function () {
            it('should email the user', async function () {
              await this.UserDeleter.promises.deleteUser(this.userId, {
                ipAddress: this.ipAddress,
              })
              const emailOptions = {
                to: 'bob@bob.com',
                action: 'account deleted',
                actionDescribed: 'your Overleaf account was deleted',
              }
              expect(
                this.EmailHandler.promises.sendEmail
              ).to.have.been.calledWith('securityAlert', emailOptions)
            })

            it('should fail when the email service fails', async function () {
              this.EmailHandler.promises.sendEmail = sinon
                .stub()
                .rejects(new Error('email failed'))
              await expect(
                this.UserDeleter.promises.deleteUser(this.userId, {
                  ipAddress: this.ipAddress,
                })
              ).to.be.rejectedWith('email failed')
            })

            describe('with "force: true" option', function () {
              it('should succeed when the email service fails', async function () {
                this.EmailHandler.promises.sendEmail = sinon
                  .stub()
                  .rejects(new Error('email failed'))
                await expect(
                  this.UserDeleter.promises.deleteUser(this.userId, {
                    ipAddress: this.ipAddress,
                    force: true,
                  })
                ).to.be.fulfilled
              })
            })
          })

          it('should add an audit log entry', async function () {
            await this.UserDeleter.promises.deleteUser(this.userId, {
              ipAddress: this.ipAddress,
            })
            expect(
              this.UserAuditLogHandler.promises.addEntry
            ).to.have.been.calledWith(
              this.userId,
              'delete-account',
              this.userId,
              this.ipAddress
            )
          })
        })

        describe('when unsubscribing from mailchimp fails', function () {
          beforeEach(function () {
            this.NewsletterManager.promises.unsubscribe.rejects(
              new Error('something went wrong')
            )
          })

          it('should return an error and not delete the user', async function () {
            await expect(
              this.UserDeleter.promises.deleteUser(this.userId, {
                ipAddress: this.ipAddress,
              })
            ).to.be.rejected
            this.UserMock.verify()
          })
        })

        describe('when called as a callback', function () {
          beforeEach(function () {
            this.UserMock.expects('deleteOne')
              .withArgs({ _id: this.userId })
              .chain('exec')
              .resolves()
          })

          it('should delete the user', function (done) {
            this.UserDeleter.deleteUser(
              this.userId,
              { ipAddress: this.ipAddress },
              err => {
                expect(err).not.to.exist
                this.UserMock.verify()
                this.DeletedUserMock.verify()
                done()
              }
            )
          })
        })
      })

      describe('when a user and IP address are specified', function () {
        beforeEach(function () {
          this.ipAddress = '1.2.3.4'
          this.deleterId = new ObjectId()

          this.deletedUser.deleterData.deleterIpAddress = this.ipAddress
          this.deletedUser.deleterData.deleterId = this.deleterId

          this.DeletedUserMock.expects('updateOne')
            .withArgs(
              { 'deleterData.deletedUserId': this.userId },
              this.deletedUser,
              { upsert: true }
            )
            .chain('exec')
            .resolves()
          this.UserMock.expects('deleteOne')
            .withArgs({ _id: this.userId })
            .chain('exec')
            .resolves()
        })

        it('should add the deleted user id and ip address to the deletedUser', async function () {
          await this.UserDeleter.promises.deleteUser(this.userId, {
            deleterUser: { _id: this.deleterId },
            ipAddress: this.ipAddress,
          })
          this.DeletedUserMock.verify()
        })

        it('should add an audit log entry', async function () {
          await this.UserDeleter.promises.deleteUser(this.userId, {
            deleterUser: { _id: this.deleterId },
            ipAddress: this.ipAddress,
          })
          expect(
            this.UserAuditLogHandler.promises.addEntry
          ).to.have.been.calledWith(
            this.userId,
            'delete-account',
            this.deleterId,
            this.ipAddress
          )
        })

        describe('when called as a callback', function () {
          it('should delete the user', function (done) {
            this.UserDeleter.deleteUser(
              this.userId,
              {
                deleterUser: { _id: this.deleterId },
                ipAddress: this.ipAddress,
              },
              err => {
                expect(err).not.to.exist
                this.UserMock.verify()
                this.DeletedUserMock.verify()
                done()
              }
            )
          })
        })
      })
    })

    describe('when the user cannot be deleted because they are a subscription admin', function () {
      beforeEach(function () {
        this.SubscriptionLocator.promises.getUsersSubscription.resolves({
          _id: 'some-subscription',
        })
      })

      it('fails with a SubscriptionAdminDeletionError', async function () {
        await expect(
          this.UserDeleter.promises.deleteUser(this.userId)
        ).to.be.rejectedWith(Errors.SubscriptionAdminDeletionError)
      })

      it('should not create a deletedUser', async function () {
        await expect(this.UserDeleter.promises.deleteUser(this.userId)).to.be
          .rejected
        this.DeletedUserMock.verify()
      })

      it('should not remove the user from mongo', async function () {
        await expect(this.UserDeleter.promises.deleteUser(this.userId)).to.be
          .rejected
        this.UserMock.verify()
      })
    })
  })

  describe('ensureCanDeleteUser', function () {
    it('should not return error when user can be deleted', async function () {
      this.SubscriptionLocator.promises.getUsersSubscription.resolves(null)
      let error
      try {
        await this.UserDeleter.promises.ensureCanDeleteUser(this.user)
      } catch (e) {
        error = e
      } finally {
        expect(error).not.to.exist
      }
    })

    it('should return custom error when user is group admin', async function () {
      this.SubscriptionLocator.promises.getUsersSubscription.resolves({
        _id: '123abc',
      })
      let error
      try {
        await this.UserDeleter.promises.ensureCanDeleteUser(this.user)
      } catch (e) {
        error = e
      } finally {
        expect(error).to.be.instanceof(Errors.SubscriptionAdminDeletionError)
      }
    })

    it('propagates errors', async function () {
      this.SubscriptionLocator.promises.getUsersSubscription.rejects(
        new Error('Some error')
      )
      let error
      try {
        await this.UserDeleter.promises.ensureCanDeleteUser(this.user)
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

    beforeEach(function () {
      this.deletedUsers = [
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

      this.DeletedUserMock.expects('find')
        .withArgs({
          'deleterData.deletedAt': {
            $lt: new Date(moment().subtract(90, 'days')),
          },
          user: {
            $ne: null,
          },
        })
        .chain('exec')
        .resolves(this.deletedUsers)
      for (const deletedUser of this.deletedUsers) {
        this.DeletedUserMock.expects('findOne')
          .withArgs({
            'deleterData.deletedUserId': deletedUser.deleterData.deletedUserId,
          })
          .chain('exec')
          .resolves(deletedUser)
      }
    })

    it('clears data from all deleted users', async function () {
      await this.UserDeleter.promises.expireDeletedUsersAfterDuration()
      for (const deletedUser of this.deletedUsers) {
        expect(deletedUser.user).to.be.undefined
        expect(deletedUser.save.called).to.be.true
      }
    })

    it('deletes audit logs for all deleted users', async function () {
      await this.UserDeleter.promises.expireDeletedUsersAfterDuration()
      for (const deletedUser of this.deletedUsers) {
        expect(this.UserAuditLogEntry.deleteMany).to.have.been.calledWith({
          userId: deletedUser.deleterData.deletedUserId,
        })
      }
    })
  })

  describe('expireDeletedUser', function () {
    beforeEach(function () {
      this.mockedDeletedUser = sinon.mock(
        new DeletedUser({
          user: this.user,
          deleterData: {
            deleterIpAddress: '1.1.1.1',
            deletedUserId: this.userId,
          },
        })
      )
      this.deletedUser = this.mockedDeletedUser.object

      this.mockedDeletedUser.expects('save').resolves()

      this.DeletedUserMock.expects('findOne')
        .withArgs({ 'deleterData.deletedUserId': this.userId })
        .chain('exec')
        .resolves(this.deletedUser)
    })

    afterEach(function () {
      this.mockedDeletedUser.restore()
    })

    it('should find the user by user ID', async function () {
      await this.UserDeleter.promises.expireDeletedUser(this.userId)
      this.DeletedUserMock.verify()
    })

    it('should remove the user data from mongo', async function () {
      await this.UserDeleter.promises.expireDeletedUser(this.userId)
      expect(this.deletedUser.user).not.to.exist
    })

    it('should remove the IP address from mongo', async function () {
      await this.UserDeleter.promises.expireDeletedUser(this.userId)
      expect(this.deletedUser.deleterData.ipAddress).not.to.exist
    })

    it('should not delete other deleterData fields', async function () {
      await this.UserDeleter.promises.expireDeletedUser(this.userId)
      expect(this.deletedUser.deleterData.deletedUserId).to.equal(this.userId)
    })

    it('should save the record to mongo', async function () {
      await this.UserDeleter.promises.expireDeletedUser(this.userId)
      this.mockedDeletedUser.verify()
    })

    it('should fire the expireDeletedUser hook for modules', async function () {
      await this.UserDeleter.promises.expireDeletedUser(this.userId)
      expect(this.Modules.promises.hooks.fire).to.have.been.calledWith(
        'expireDeletedUser',
        this.userId
      )
    })

    it('should delete Feeback', async function () {
      await this.UserDeleter.promises.expireDeletedUser(this.userId)
      expect(this.Feedback.deleteMany).to.have.been.calledWith({
        userId: this.userId,
      })
    })

    describe('when called as a callback', function () {
      it('should expire the user', function (done) {
        this.UserDeleter.expireDeletedUser(this.userId, err => {
          expect(err).not.to.exist
          this.DeletedUserMock.verify()
          this.mockedDeletedUser.verify()
          expect(this.deletedUser.user).not.to.exist
          expect(this.deletedUser.deleterData.ipAddress).not.to.exist
          done()
        })
      })
    })
  })
})
