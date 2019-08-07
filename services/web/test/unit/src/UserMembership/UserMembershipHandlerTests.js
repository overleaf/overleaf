/* eslint-disable
    handle-callback-err,
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
const chai = require('chai')
const should = chai.should()
const { expect } = require('chai')
const sinon = require('sinon')
const assertCalledWith = sinon.assert.calledWith
const assertNotCalled = sinon.assert.notCalled
const { ObjectId } = require('../../../../app/src/infrastructure/mongojs')
const modulePath =
  '../../../../app/src/Features/UserMembership/UserMembershipHandler'
const SandboxedModule = require('sandboxed-module')
const Errors = require('../../../../app/src/Features/Errors/Errors')
const EntityConfigs = require('../../../../app/src/Features/UserMembership/UserMembershipEntityConfigs')

describe('UserMembershipHandler', function() {
  beforeEach(function() {
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
      update: sinon.stub().yields(null)
    }
    this.institution = {
      _id: 'mock-institution-id',
      v1Id: 123,
      managerIds: [ObjectId(), ObjectId(), ObjectId()],
      update: sinon.stub().yields(null)
    }
    this.publisher = {
      _id: 'mock-publisher-id',
      slug: 'slug',
      managerIds: [ObjectId(), ObjectId()],
      update: sinon.stub().yields(null)
    }

    this.UserMembershipViewModel = {
      buildAsync: sinon.stub().yields(null, { _id: 'mock-member-id' }),
      build: sinon.stub().returns(this.newUser)
    }
    this.UserGetter = {
      getUserByAnyEmail: sinon.stub().yields(null, this.newUser)
    }
    this.Institution = { findOne: sinon.stub().yields(null, this.institution) }
    this.Subscription = {
      findOne: sinon.stub().yields(null, this.subscription)
    }
    this.Publisher = {
      findOne: sinon.stub().yields(null, this.publisher),
      create: sinon.stub().yields(null, this.publisher)
    }
    return (this.UserMembershipHandler = SandboxedModule.require(modulePath, {
      globals: {
        console: console
      },
      requires: {
        './UserMembershipViewModel': this.UserMembershipViewModel,
        '../User/UserGetter': this.UserGetter,
        '../Errors/Errors': Errors,
        '../../models/Institution': {
          Institution: this.Institution
        },
        '../../models/Subscription': {
          Subscription: this.Subscription
        },
        '../../models/Publisher': {
          Publisher: this.Publisher
        },
        'logger-sharelatex': {
          log() {},
          err() {}
        }
      }
    }))
  })

  describe('getEntity', function() {
    describe('group subscriptions', function() {
      it('get subscription', function(done) {
        return this.UserMembershipHandler.getEntity(
          this.fakeEntityId,
          EntityConfigs.group,
          this.user,
          null,
          (error, subscription) => {
            should.not.exist(error)
            const expectedQuery = {
              groupPlan: true,
              _id: this.fakeEntityId,
              manager_ids: ObjectId(this.user._id)
            }
            assertCalledWith(this.Subscription.findOne, expectedQuery)
            expect(subscription).to.equal(this.subscription)
            expect(subscription.membersLimit).to.equal(10)
            return done()
          }
        )
      })

      it('get for admin', function(done) {
        return this.UserMembershipHandler.getEntity(
          this.fakeEntityId,
          EntityConfigs.group,
          { isAdmin: true },
          null,
          (error, subscription) => {
            should.not.exist(error)
            const expectedQuery = {
              groupPlan: true,
              _id: this.fakeEntityId
            }
            assertCalledWith(this.Subscription.findOne, expectedQuery)
            return done()
          }
        )
      })

      it('get with staffAccess field', function(done) {
        return this.UserMembershipHandler.getEntity(
          this.fakeEntityId,
          EntityConfigs.group,
          { staffAccess: { institutionMetrics: true } },
          'institutionMetrics',
          (error, subscription) => {
            should.not.exist(error)
            const expectedQuery = {
              groupPlan: true,
              _id: this.fakeEntityId
            }
            assertCalledWith(this.Subscription.findOne, expectedQuery)
            return done()
          }
        )
      })

      it('handle error', function(done) {
        this.Subscription.findOne.yields(new Error('some error'))
        return this.UserMembershipHandler.getEntity(
          this.fakeEntityId,
          EntityConfigs.group,
          this.user._id,
          null,
          (error, subscription) => {
            should.exist(error)
            return done()
          }
        )
      })
    })
  })

  describe('getEntityWithoutAuthorizationCheck', function() {
    it('get publisher', function(done) {
      return this.UserMembershipHandler.getEntityWithoutAuthorizationCheck(
        this.fakeEntityId,
        EntityConfigs.publisher,
        (error, subscription) => {
          should.not.exist(error)
          const expectedQuery = { slug: this.fakeEntityId }
          assertCalledWith(this.Publisher.findOne, expectedQuery)
          expect(subscription).to.equal(this.publisher)
          return done()
        }
      )
    })

    describe('institutions', function() {
      it('get institution', function(done) {
        return this.UserMembershipHandler.getEntity(
          this.institution.v1Id,
          EntityConfigs.institution,
          this.user,
          null,
          (error, institution) => {
            should.not.exist(error)
            const expectedQuery = {
              v1Id: this.institution.v1Id,
              managerIds: ObjectId(this.user._id)
            }
            assertCalledWith(this.Institution.findOne, expectedQuery)
            expect(institution).to.equal(this.institution)
            return done()
          }
        )
      })

      it('handle errors', function(done) {
        this.Institution.findOne.yields(new Error('nope'))
        return this.UserMembershipHandler.getEntity(
          this.fakeEntityId,
          EntityConfigs.institution,
          this.user._id,
          null,
          (error, institution) => {
            should.exist(error)
            expect(error).to.not.be.an.instanceof(Errors.NotFoundError)
            return done()
          }
        )
      })
    })

    describe('publishers', function() {
      it('get publisher', function(done) {
        return this.UserMembershipHandler.getEntity(
          this.publisher.slug,
          EntityConfigs.publisher,
          this.user,
          null,
          (error, institution) => {
            should.not.exist(error)
            const expectedQuery = {
              slug: this.publisher.slug,
              managerIds: ObjectId(this.user._id)
            }
            assertCalledWith(this.Publisher.findOne, expectedQuery)
            expect(institution).to.equal(this.publisher)
            return done()
          }
        )
      })
    })
  })

  describe('getUsers', function() {
    describe('group', function() {
      it('build view model for all users', function(done) {
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

    describe('group mamagers', function() {
      it('build view model for all managers', function(done) {
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

    describe('institution', function() {
      it('build view model for all managers', function(done) {
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

  describe('createEntity', function() {
    it('creates publisher', function(done) {
      return this.UserMembershipHandler.createEntity(
        this.fakeEntityId,
        EntityConfigs.publisher,
        (error, publisher) => {
          should.not.exist(error)
          assertCalledWith(this.Publisher.create, { slug: this.fakeEntityId })
          return done()
        }
      )
    })
  })

  describe('addUser', function() {
    beforeEach(function() {
      return (this.email = this.newUser.email)
    })

    describe('institution', function() {
      it('get user', function(done) {
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

      it('handle user not found', function(done) {
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

      it('handle user already added', function(done) {
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

      it('add user to institution', function(done) {
        return this.UserMembershipHandler.addUser(
          this.institution,
          EntityConfigs.institution,
          this.email,
          (error, user) => {
            assertCalledWith(this.institution.update, {
              $addToSet: { managerIds: this.newUser._id }
            })
            return done()
          }
        )
      })

      it('return user view', function(done) {
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

  describe('removeUser', function() {
    describe('institution', function() {
      it('remove user from institution', function(done) {
        return this.UserMembershipHandler.removeUser(
          this.institution,
          EntityConfigs.institution,
          this.newUser._id,
          (error, user) => {
            const { lastCall } = this.institution.update
            assertCalledWith(this.institution.update, {
              $pull: { managerIds: this.newUser._id }
            })
            return done()
          }
        )
      })

      it('handle admin', function(done) {
        this.subscription.admin_id = this.newUser._id
        return this.UserMembershipHandler.removeUser(
          this.subscription,
          EntityConfigs.groupManagers,
          this.newUser._id,
          (error, user) => {
            expect(error).to.exist
            expect(error.isAdmin).to.equal(true)
            return done()
          }
        )
      })
    })
  })
})
