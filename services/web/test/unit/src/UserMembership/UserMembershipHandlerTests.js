/* eslint-disable
    node/handle-callback-err,
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
const { expect } = require('chai')
const sinon = require('sinon')
const assertCalledWith = sinon.assert.calledWith
const assertNotCalled = sinon.assert.notCalled
const { ObjectId } = require('mongodb')
const modulePath =
  '../../../../app/src/Features/UserMembership/UserMembershipHandler'
const SandboxedModule = require('sandboxed-module')
const Errors = require('../../../../app/src/Features/Errors/Errors')
const EntityConfigs = require('../../../../app/src/Features/UserMembership/UserMembershipEntityConfigs')
const {
  UserIsManagerError,
} = require('../../../../app/src/Features/UserMembership/UserMembershipErrors')

describe('UserMembershipHandler', function () {
  beforeEach(function () {
    this.user = { _id: ObjectId() }
    this.newUser = { _id: ObjectId(), email: 'new-user-email@foo.bar' }
    this.fakeEntityId = ObjectId()
    this.subscription = {
      _id: 'mock-subscription-id',
      groupPlan: true,
      membersLimit: 10,
      member_ids: [ObjectId(), ObjectId()],
      manager_ids: [ObjectId()],
      invited_emails: ['mock-email-1@foo.com'],
      teamInvites: [{ email: 'mock-email-1@bar.com' }],
      update: sinon.stub().yields(null),
    }
    this.institution = {
      _id: 'mock-institution-id',
      v1Id: 123,
      managerIds: [ObjectId(), ObjectId(), ObjectId()],
      updateOne: sinon.stub().yields(null),
    }
    this.publisher = {
      _id: 'mock-publisher-id',
      slug: 'slug',
      managerIds: [ObjectId(), ObjectId()],
      updateOne: sinon.stub().yields(null),
    }

    this.UserMembershipViewModel = {
      buildAsync: sinon.stub().yields(null, { _id: 'mock-member-id' }),
      build: sinon.stub().returns(this.newUser),
    }
    this.UserGetter = {
      getUserByAnyEmail: sinon.stub().yields(null, this.newUser),
    }
    this.Institution = { findOne: sinon.stub().yields(null, this.institution) }
    this.Subscription = {
      findOne: sinon.stub().yields(null, this.subscription),
    }
    this.Publisher = {
      findOne: sinon.stub().yields(null, this.publisher),
      create: sinon.stub().yields(null, this.publisher),
    }
    return (this.UserMembershipHandler = SandboxedModule.require(modulePath, {
      requires: {
        mongodb: { ObjectId },
        './UserMembershipErrors': { UserIsManagerError },
        './UserMembershipViewModel': this.UserMembershipViewModel,
        '../User/UserGetter': this.UserGetter,
        '../../models/Institution': {
          Institution: this.Institution,
        },
        '../../models/Subscription': {
          Subscription: this.Subscription,
        },
        '../../models/Publisher': {
          Publisher: this.Publisher,
        },
      },
    }))
  })

  describe('getEntityWithoutAuthorizationCheck', function () {
    it('get publisher', function (done) {
      return this.UserMembershipHandler.getEntityWithoutAuthorizationCheck(
        this.fakeEntityId,
        EntityConfigs.publisher,
        (error, subscription) => {
          expect(error).not.to.exist
          const expectedQuery = { slug: this.fakeEntityId }
          assertCalledWith(this.Publisher.findOne, expectedQuery)
          expect(subscription).to.equal(this.publisher)
          return done()
        }
      )
    })
  })

  describe('getUsers', function () {
    describe('group', function () {
      it('build view model for all users', function (done) {
        return this.UserMembershipHandler.getUsers(
          this.subscription,
          EntityConfigs.group,
          (error, users) => {
            const expectedCallcount =
              this.subscription.member_ids.length +
              this.subscription.invited_emails.length +
              this.subscription.teamInvites.length
            expect(this.UserMembershipViewModel.buildAsync.callCount).to.equal(
              expectedCallcount
            )
            return done()
          }
        )
      })
    })

    describe('group mamagers', function () {
      it('build view model for all managers', function (done) {
        return this.UserMembershipHandler.getUsers(
          this.subscription,
          EntityConfigs.groupManagers,
          (error, users) => {
            const expectedCallcount = this.subscription.manager_ids.length
            expect(this.UserMembershipViewModel.buildAsync.callCount).to.equal(
              expectedCallcount
            )
            return done()
          }
        )
      })
    })

    describe('institution', function () {
      it('build view model for all managers', function (done) {
        return this.UserMembershipHandler.getUsers(
          this.institution,
          EntityConfigs.institution,
          (error, users) => {
            const expectedCallcount = this.institution.managerIds.length
            expect(this.UserMembershipViewModel.buildAsync.callCount).to.equal(
              expectedCallcount
            )
            return done()
          }
        )
      })
    })
  })

  describe('createEntity', function () {
    it('creates publisher', function (done) {
      return this.UserMembershipHandler.createEntity(
        this.fakeEntityId,
        EntityConfigs.publisher,
        (error, publisher) => {
          expect(error).not.to.exist
          assertCalledWith(this.Publisher.create, { slug: this.fakeEntityId })
          return done()
        }
      )
    })
  })

  describe('addUser', function () {
    beforeEach(function () {
      return (this.email = this.newUser.email)
    })

    describe('institution', function () {
      it('get user', function (done) {
        return this.UserMembershipHandler.addUser(
          this.institution,
          EntityConfigs.institution,
          this.email,
          (error, user) => {
            assertCalledWith(this.UserGetter.getUserByAnyEmail, this.email)
            return done()
          }
        )
      })

      it('handle user not found', function (done) {
        this.UserGetter.getUserByAnyEmail.yields(null, null)
        return this.UserMembershipHandler.addUser(
          this.institution,
          EntityConfigs.institution,
          this.email,
          error => {
            expect(error).to.exist
            expect(error.userNotFound).to.equal(true)
            return done()
          }
        )
      })

      it('handle user already added', function (done) {
        this.institution.managerIds.push(this.newUser._id)
        return this.UserMembershipHandler.addUser(
          this.institution,
          EntityConfigs.institution,
          this.email,
          (error, users) => {
            expect(error).to.exist
            expect(error.alreadyAdded).to.equal(true)
            return done()
          }
        )
      })

      it('add user to institution', function (done) {
        return this.UserMembershipHandler.addUser(
          this.institution,
          EntityConfigs.institution,
          this.email,
          (error, user) => {
            assertCalledWith(this.institution.updateOne, {
              $addToSet: { managerIds: this.newUser._id },
            })
            return done()
          }
        )
      })

      it('return user view', function (done) {
        return this.UserMembershipHandler.addUser(
          this.institution,
          EntityConfigs.institution,
          this.email,
          (error, user) => {
            user.should.equal(this.newUser)
            return done()
          }
        )
      })
    })
  })

  describe('removeUser', function () {
    describe('institution', function () {
      it('remove user from institution', function (done) {
        return this.UserMembershipHandler.removeUser(
          this.institution,
          EntityConfigs.institution,
          this.newUser._id,
          (error, user) => {
            const { lastCall } = this.institution.updateOne
            assertCalledWith(this.institution.updateOne, {
              $pull: { managerIds: this.newUser._id },
            })
            return done()
          }
        )
      })

      it('handle admin', function (done) {
        this.subscription.admin_id = this.newUser._id
        return this.UserMembershipHandler.removeUser(
          this.subscription,
          EntityConfigs.groupManagers,
          this.newUser._id,
          (error, user) => {
            expect(error).to.exist
            expect(error).to.be.instanceof(UserIsManagerError)
            return done()
          }
        )
      })
    })
  })
})
