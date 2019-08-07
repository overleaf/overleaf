const chai = require('chai')
const sinon = require('sinon')
const tk = require('timekeeper')
const moment = require('moment')
const SandboxedModule = require('sandboxed-module')
const Errors = require('../../../../app/src/Features/Errors/Errors')
const ObjectId = require('mongoose').Types.ObjectId
const { User } = require('../helpers/models/User')
const { DeletedUser } = require('../helpers/models/DeletedUser')

const expect = chai.expect

const modulePath = '../../../../app/src/Features/User/UserDeleter.js'

describe('UserDeleter', function() {
  beforeEach(function() {
    tk.freeze(Date.now())

    this.userId = ObjectId()

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
          id: 1234
        },
        refered_users: ['wombat', 'potato'],
        refered_user_count: 2,
        referal_id: ['giraffe']
      })
    )
    this.user = this.mockedUser.object

    this.NewsletterManager = { unsubscribe: sinon.stub().yields() }

    this.ProjectDeleter = {
      promises: {
        deleteUsersProjects: sinon.stub().resolves()
      }
    }

    this.SubscriptionHandler = {
      cancelSubscription: sinon.stub().yields()
    }

    this.SubscriptionUpdater = {
      removeUserFromAllGroups: sinon.stub().yields()
    }

    this.SubscriptionLocator = {
      getUsersSubscription: sinon.stub().yields()
    }

    this.UserMembershipsHandler = {
      removeUserFromAllEntities: sinon.stub().yields()
    }

    this.InstitutionsApi = {
      deleteAffiliations: sinon.stub().yields()
    }

    this.UserDeleter = SandboxedModule.require(modulePath, {
      requires: {
        '../../models/User': { User: User },
        '../../models/DeletedUser': { DeletedUser: DeletedUser },
        '../Newsletter/NewsletterManager': this.NewsletterManager,
        '../Subscription/SubscriptionHandler': this.SubscriptionHandler,
        '../Subscription/SubscriptionUpdater': this.SubscriptionUpdater,
        '../Subscription/SubscriptionLocator': this.SubscriptionLocator,
        '../UserMembership/UserMembershipsHandler': this.UserMembershipsHandler,
        '../Project/ProjectDeleter': this.ProjectDeleter,
        '../Institutions/InstitutionsAPI': this.InstitutionsApi,
        'logger-sharelatex': (this.logger = {
          log: sinon.stub(),
          warn: sinon.stub(),
          err: sinon.stub()
        }),
        '../Errors/Errors': Errors
      },
      globals: {
        console: console
      }
    })
  })

  afterEach(function() {
    this.DeletedUserMock.restore()
    this.UserMock.restore()
    this.mockedUser.restore()
  })

  describe('deleteUser', function() {
    beforeEach(function() {
      this.UserDeleter.promises.ensureCanDeleteUser = sinon.stub().resolves()

      this.UserMock.expects('findById')
        .withArgs(this.userId)
        .chain('exec')
        .resolves(this.user)
    })

    describe('when the user can be deleted', function() {
      beforeEach(function() {
        this.deletedUser = {
          user: this.user,
          deleterData: {
            deletedAt: new Date(),
            deletedUserId: this.userId,
            deleterIpAddress: undefined,
            deleterId: undefined,
            deletedUserLastLoggedIn: this.user.lastLoggedIn,
            deletedUserSignUpDate: this.user.signUpDate,
            deletedUserLoginCount: this.user.loginCount,
            deletedUserReferralId: this.user.referal_id,
            deletedUserReferredUsers: this.user.refered_users,
            deletedUserReferredUserCount: this.user.refered_user_count,
            deletedUserOverleafId: this.user.overleaf.id
          }
        }

        this.UserMock.expects('deleteOne')
          .withArgs({ _id: this.userId })
          .chain('exec')
          .resolves()
      })

      describe('when no options are passed', function() {
        beforeEach(function() {
          this.DeletedUserMock.expects('create')
            .withArgs(this.deletedUser)
            .chain('exec')
            .resolves()
        })

        it('should find and the user in mongo by its id', async function() {
          await this.UserDeleter.promises.deleteUser(this.userId)
          this.UserMock.verify()
        })

        it('should unsubscribe the user from the news letter', async function() {
          await this.UserDeleter.promises.deleteUser(this.userId)
          expect(this.NewsletterManager.unsubscribe).to.have.been.calledWith(
            this.user
          )
        })

        it('should delete all the projects of a user', async function() {
          await this.UserDeleter.promises.deleteUser(this.userId)
          expect(
            this.ProjectDeleter.promises.deleteUsersProjects
          ).to.have.been.calledWith(this.userId)
        })

        it("should cancel the user's subscription", async function() {
          await this.UserDeleter.promises.deleteUser(this.userId)
          expect(
            this.SubscriptionHandler.cancelSubscription
          ).to.have.been.calledWith(this.user)
        })

        it('should delete user affiliations', async function() {
          await this.UserDeleter.promises.deleteUser(this.userId)
          expect(
            this.InstitutionsApi.deleteAffiliations
          ).to.have.been.calledWith(this.userId)
        })

        it('should remove user from group subscriptions', async function() {
          await this.UserDeleter.promises.deleteUser(this.userId)
          expect(
            this.SubscriptionUpdater.removeUserFromAllGroups
          ).to.have.been.calledWith(this.userId)
        })

        it('should remove user memberships', async function() {
          await this.UserDeleter.promises.deleteUser(this.userId)
          expect(
            this.UserMembershipsHandler.removeUserFromAllEntities
          ).to.have.been.calledWith(this.userId)
        })

        it('ensures user can be deleted', async function() {
          await this.UserDeleter.promises.deleteUser(this.userId)
          expect(
            this.UserDeleter.promises.ensureCanDeleteUser
          ).to.have.been.calledWith(this.user)
        })

        it('should create a deletedUser', async function() {
          await this.UserDeleter.promises.deleteUser(this.userId)
          this.DeletedUserMock.verify()
        })

        describe('when unsubscribing from mailchimp fails', function() {
          beforeEach(function() {
            this.NewsletterManager.unsubscribe = sinon
              .stub()
              .yields(new Error('something went wrong'))
          })

          it('should not return an error', async function() {
            try {
              await this.UserDeleter.promises.deleteUser(this.userId)
            } catch (error) {
              expect(error).not.to.exist
              expect.fail()
            }
            // check that we called `unsubscribe` to generate the error
            expect(this.NewsletterManager.unsubscribe).to.have.been.calledWith(
              this.user
            )
          })

          it('should delete the user', async function() {
            await this.UserDeleter.promises.deleteUser(this.userId)
            this.UserMock.verify()
          })

          it('should log an error', async function() {
            await this.UserDeleter.promises.deleteUser(this.userId)
            sinon.assert.called(this.logger.err)
          })
        })

        describe('when called as a callback', function() {
          it('should delete the user', function(done) {
            this.UserDeleter.deleteUser(this.userId, err => {
              expect(err).not.to.exist
              this.UserMock.verify()
              this.DeletedUserMock.verify()
              done()
            })
          })
        })
      })

      describe('when a user and IP address are specified', function() {
        beforeEach(function() {
          this.ipAddress = '1.2.3.4'
          this.deleterId = ObjectId()

          this.deletedUser.deleterData.deleterIpAddress = this.ipAddress
          this.deletedUser.deleterData.deleterId = this.deleterId

          this.DeletedUserMock.expects('create')
            .withArgs(this.deletedUser)
            .chain('exec')
            .resolves()
        })

        it('should add the deleted user id and ip address to the deletedUser', async function() {
          await this.UserDeleter.promises.deleteUser(this.userId, {
            deleterUser: { _id: this.deleterId },
            ipAddress: this.ipAddress
          })
          this.DeletedUserMock.verify()
        })

        describe('when called as a callback', function() {
          it('should delete the user', function(done) {
            this.UserDeleter.deleteUser(
              this.userId,
              {
                deleterUser: { _id: this.deleterId },
                ipAddress: this.ipAddress
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

    describe('when the user cannot be deleted because they are a subscription admin', function() {
      beforeEach(function() {
        this.UserDeleter.promises.ensureCanDeleteUser.rejects(
          new Errors.SubscriptionAdminDeletionError()
        )
      })

      it('fails with a SubscriptionAdminDeletionError', async function() {
        let error
        try {
          await this.UserDeleter.promises.deleteUser(this.userId)
        } catch (e) {
          error = e
        } finally {
          expect(error).to.be.instanceof(Errors.SubscriptionAdminDeletionError)
        }
      })

      it('should not create a deletedUser', async function() {
        try {
          await this.UserDeleter.promises.deleteUser(this.userId)
        } catch (e) {
        } finally {
          this.DeletedUserMock.verify()
        }
      })

      it('should not remove the user from mongo', async function() {
        try {
          await this.UserDeleter.promises.deleteUser(this.userId)
        } catch (e) {
        } finally {
          this.UserMock.verify()
        }
      })
    })
  })

  describe('ensureCanDeleteUser', function() {
    it('should not return error when user can be deleted', async function() {
      this.SubscriptionLocator.getUsersSubscription.yields(null, null)
      let error
      try {
        await this.UserDeleter.promises.ensureCanDeleteUser(this.user)
      } catch (e) {
        error = e
      } finally {
        expect(error).not.to.exist
      }
    })

    it('should return custom error when user is group admin', async function() {
      this.SubscriptionLocator.getUsersSubscription.yields(null, {
        _id: '123abc'
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

    it('propagates errors', async function() {
      this.SubscriptionLocator.getUsersSubscription.yields(
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

  describe('expireDeletedUsersAfterDuration', function() {
    beforeEach(function() {
      this.UserDeleter.promises.expireDeletedUser = sinon.stub().resolves()
      this.deletedUsers = [
        {
          user: { _id: 'wombat' },
          deleterData: { deletedUserId: 'wombat' }
        },
        {
          user: { _id: 'potato' },
          deleterData: { deletedUserId: 'potato' }
        }
      ]

      this.DeletedUserMock.expects('find')
        .withArgs({
          'deleterData.deletedAt': {
            $lt: new Date(moment().subtract(90, 'days'))
          },
          user: {
            $ne: null
          }
        })
        .chain('exec')
        .resolves(this.deletedUsers)
    })

    it('calls expireDeletedUser for each user', async function() {
      await this.UserDeleter.promises.expireDeletedUsersAfterDuration()
      expect(
        this.UserDeleter.promises.expireDeletedUser
      ).to.have.been.calledWith('wombat')
      expect(
        this.UserDeleter.promises.expireDeletedUser
      ).to.have.been.calledWith('potato')
    })
  })

  describe('expireDeletedUser', function() {
    beforeEach(function() {
      this.mockedDeletedUser = sinon.mock(
        new DeletedUser({
          user: this.user,
          deleterData: {
            deleterIpAddress: '1.1.1.1',
            deletedUserId: this.userId
          }
        })
      )
      this.deletedUser = this.mockedDeletedUser.object

      this.mockedDeletedUser.expects('save').resolves()

      this.DeletedUserMock.expects('findOne')
        .withArgs({ 'deleterData.deletedUserId': 'giraffe' })
        .chain('exec')
        .resolves(this.deletedUser)
    })

    afterEach(function() {
      this.mockedDeletedUser.restore()
    })

    it('should find the user by user ID', async function() {
      await this.UserDeleter.promises.expireDeletedUser('giraffe')
      this.DeletedUserMock.verify()
    })

    it('should remove the user data from mongo', async function() {
      await this.UserDeleter.promises.expireDeletedUser('giraffe')
      expect(this.deletedUser.user).not.to.exist
    })

    it('should remove the IP address from mongo', async function() {
      await this.UserDeleter.promises.expireDeletedUser('giraffe')
      expect(this.deletedUser.deleterData.ipAddress).not.to.exist
    })

    it('should not delete other deleterData fields', async function() {
      await this.UserDeleter.promises.expireDeletedUser('giraffe')
      expect(this.deletedUser.deleterData.deletedUserId).to.equal(this.userId)
    })

    it('should save the record to mongo', async function() {
      await this.UserDeleter.promises.expireDeletedUser('giraffe')
      this.mockedDeletedUser.verify()
    })

    describe('when called as a callback', function() {
      it('should expire the user', function(done) {
        this.UserDeleter.expireDeletedUser('giraffe', err => {
          expect(err).not.to.exists
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
