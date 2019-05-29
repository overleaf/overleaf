/* eslint-disable
    handle-callback-err,
    max-len,
    no-return-assign,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const sinon = require('sinon')
const chai = require('chai')
const should = chai.should()
const { expect } = chai
const modulePath = '../../../../app/src/Features/User/UserDeleter.js'
const SandboxedModule = require('sandboxed-module')
const Errors = require('../../../../app/src/Features/Errors/Errors')

describe('UserDeleter', function() {
  beforeEach(function() {
    this.user = {
      _id: '12390i',
      email: 'bob@bob.com',
      remove: sinon.stub().callsArgWith(0)
    }

    this.User = { findById: sinon.stub().callsArgWith(1, null, this.user) }

    this.NewsletterManager = { unsubscribe: sinon.stub().callsArgWith(1) }

    this.ProjectDeleter = { deleteUsersProjects: sinon.stub().callsArgWith(1) }

    this.SubscriptionHandler = {
      cancelSubscription: sinon.stub().callsArgWith(1)
    }

    this.SubscriptionUpdater = {
      removeUserFromAllGroups: sinon.stub().callsArgWith(1)
    }

    this.SubscriptionLocator = {
      getUsersSubscription: sinon.stub().yields(null, null)
    }

    this.UserMembershipsHandler = {
      removeUserFromAllEntities: sinon.stub().callsArgWith(1)
    }

    this.deleteAffiliations = sinon.stub().callsArgWith(1)

    this.mongojs = {
      db: {
        deletedUsers: {
          insert: sinon.stub().callsArg(1)
        },
        usersDeletedByMigration: {
          insert: sinon.stub().callsArg(1)
        }
      }
    }

    return (this.UserDeleter = SandboxedModule.require(modulePath, {
      requires: {
        '../../models/User': {
          User: this.User
        },
        '../Newsletter/NewsletterManager': this.NewsletterManager,
        '../Subscription/SubscriptionHandler': this.SubscriptionHandler,
        '../Subscription/SubscriptionUpdater': this.SubscriptionUpdater,
        '../Subscription/SubscriptionLocator': this.SubscriptionLocator,
        '../UserMembership/UserMembershipsHandler': this.UserMembershipsHandler,
        '../Project/ProjectDeleter': this.ProjectDeleter,
        '../Institutions/InstitutionsAPI': {
          deleteAffiliations: this.deleteAffiliations
        },
        '../../infrastructure/mongojs': this.mongojs,
        'logger-sharelatex': (this.logger = {
          log: sinon.stub(),
          err: sinon.stub()
        }),
        '../Errors/Errors': Errors
      }
    }))
  })

  describe('softDeleteUserForMigration', function() {
    beforeEach(function() {
      return (this.UserDeleter._ensureCanDeleteUser = sinon.stub().yields(null))
    })

    it('should delete the user in mongo', function(done) {
      return this.UserDeleter.softDeleteUserForMigration(this.user._id, err => {
        this.User.findById.calledWith(this.user._id).should.equal(true)
        this.user.remove.called.should.equal(true)
        return done()
      })
    })

    it('should add the user to the deletedUsers collection', function(done) {
      return this.UserDeleter.softDeleteUserForMigration(this.user._id, err => {
        sinon.assert.calledWith(
          this.mongojs.db.usersDeletedByMigration.insert,
          this.user
        )
        return done()
      })
    })

    it('should set the deletedAt field on the user', function(done) {
      return this.UserDeleter.softDeleteUserForMigration(this.user._id, err => {
        this.user.deletedAt.should.exist
        return done()
      })
    })

    it('should unsubscribe the user from the news letter', function(done) {
      return this.UserDeleter.softDeleteUserForMigration(this.user._id, err => {
        this.NewsletterManager.unsubscribe
          .calledWith(this.user)
          .should.equal(true)
        return done()
      })
    })

    it('should unsubscribe the user', function(done) {
      return this.UserDeleter.softDeleteUserForMigration(this.user._id, err => {
        this.SubscriptionHandler.cancelSubscription
          .calledWith(this.user)
          .should.equal(true)
        return done()
      })
    })

    it('should delete user affiliations', function(done) {
      return this.UserDeleter.softDeleteUserForMigration(this.user._id, err => {
        this.deleteAffiliations.calledWith(this.user._id).should.equal(true)
        return done()
      })
    })

    it('should delete all the projects of a user', function(done) {
      return this.UserDeleter.softDeleteUserForMigration(this.user._id, err => {
        this.ProjectDeleter.deleteUsersProjects
          .calledWith(this.user._id)
          .should.equal(true)
        return done()
      })
    })

    it('should remove user memberships', function(done) {
      return this.UserDeleter.softDeleteUserForMigration(this.user._id, err => {
        this.UserMembershipsHandler.removeUserFromAllEntities
          .calledWith(this.user._id)
          .should.equal(true)
        return done()
      })
    })

    return it('ensures user can be deleted first', function(done) {
      this.UserDeleter._ensureCanDeleteUser.yields(
        new Errors.SubscriptionAdminDeletionError()
      )
      return this.UserDeleter.softDeleteUserForMigration(
        this.user._id,
        error => {
          sinon.assert.calledWith(
            this.UserDeleter._ensureCanDeleteUser,
            this.user
          )
          sinon.assert.notCalled(this.user.remove)
          expect(error).to.be.instanceof(Errors.SubscriptionAdminDeletionError)
          return done()
        }
      )
    })
  })

  describe('deleteUser', function() {
    beforeEach(function() {
      return (this.UserDeleter._ensureCanDeleteUser = sinon.stub().yields(null))
    })

    it('should delete the user in mongo', function(done) {
      return this.UserDeleter.deleteUser(this.user._id, err => {
        this.User.findById.calledWith(this.user._id).should.equal(true)
        this.user.remove.called.should.equal(true)
        return done()
      })
    })

    it('should unsubscribe the user from the news letter', function(done) {
      return this.UserDeleter.deleteUser(this.user._id, err => {
        this.NewsletterManager.unsubscribe
          .calledWith(this.user)
          .should.equal(true)
        return done()
      })
    })

    it('should delete all the projects of a user', function(done) {
      return this.UserDeleter.deleteUser(this.user._id, err => {
        this.ProjectDeleter.deleteUsersProjects
          .calledWith(this.user._id)
          .should.equal(true)
        return done()
      })
    })

    it('should unsubscribe the user', function(done) {
      return this.UserDeleter.deleteUser(this.user._id, err => {
        this.SubscriptionHandler.cancelSubscription
          .calledWith(this.user)
          .should.equal(true)
        return done()
      })
    })

    it('should delete user affiliations', function(done) {
      return this.UserDeleter.deleteUser(this.user._id, err => {
        this.deleteAffiliations.calledWith(this.user._id).should.equal(true)
        return done()
      })
    })

    it('should remove user from group subscriptions', function(done) {
      return this.UserDeleter.deleteUser(this.user._id, err => {
        this.SubscriptionUpdater.removeUserFromAllGroups
          .calledWith(this.user._id)
          .should.equal(true)
        return done()
      })
    })

    it('should remove user memberships', function(done) {
      return this.UserDeleter.deleteUser(this.user._id, err => {
        this.UserMembershipsHandler.removeUserFromAllEntities
          .calledWith(this.user._id)
          .should.equal(true)
        return done()
      })
    })

    it('ensures user can be deleted first', function(done) {
      this.UserDeleter._ensureCanDeleteUser.yields(
        new Errors.SubscriptionAdminDeletionError()
      )
      return this.UserDeleter.deleteUser(this.user._id, error => {
        sinon.assert.calledWith(
          this.UserDeleter._ensureCanDeleteUser,
          this.user
        )
        sinon.assert.notCalled(this.user.remove)
        expect(error).to.be.instanceof(Errors.SubscriptionAdminDeletionError)
        return done()
      })
    })

    return describe('when unsubscribing from mailchimp fails', function() {
      beforeEach(function() {
        return (this.NewsletterManager.unsubscribe = sinon
          .stub()
          .callsArgWith(1, new Error('something went wrong')))
      })

      it('should not return an error', function(done) {
        return this.UserDeleter.deleteUser(this.user._id, err => {
          this.NewsletterManager.unsubscribe
            .calledWith(this.user)
            .should.equal(true)
          should.not.exist(err)
          return done()
        })
      })

      it('should delete the user', function(done) {
        return this.UserDeleter.deleteUser(this.user._id, err => {
          this.NewsletterManager.unsubscribe
            .calledWith(this.user)
            .should.equal(true)
          this.user.remove.called.should.equal(true)
          return done()
        })
      })

      return it('should log an error', function(done) {
        return this.UserDeleter.deleteUser(this.user._id, err => {
          sinon.assert.called(this.logger.err)
          return done()
        })
      })
    })
  })

  return describe('_ensureCanDeleteUser', function() {
    it('should not return error when user can be deleted', function(done) {
      this.SubscriptionLocator.getUsersSubscription.yields(null, null)
      return this.UserDeleter._ensureCanDeleteUser(this.user, function(error) {
        expect(error).to.not.exist
        return done()
      })
    })

    it('should return custom error when user is group admin', function(done) {
      this.SubscriptionLocator.getUsersSubscription.yields(null, {
        _id: '123abc'
      })
      return this.UserDeleter._ensureCanDeleteUser(this.user, function(error) {
        expect(error).to.be.instanceof(Errors.SubscriptionAdminDeletionError)
        return done()
      })
    })

    return it('propagate errors', function(done) {
      this.SubscriptionLocator.getUsersSubscription.yields(
        new Error('Some error')
      )
      return this.UserDeleter._ensureCanDeleteUser(this.user, function(error) {
        expect(error).to.be.instanceof(Error)
        return done()
      })
    })
  })
})
