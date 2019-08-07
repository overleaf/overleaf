/* eslint-disable
    camelcase,
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
const SandboxedModule = require('sandboxed-module')
const sinon = require('sinon')
require('chai').should()
const modulePath = require('path').join(
  __dirname,
  '../../../../app/src/Features/Subscription/LimitationsManager'
)
const Settings = require('settings-sharelatex')

describe('LimitationsManager', function() {
  beforeEach(function() {
    this.project = { _id: (this.project_id = 'project-id') }
    this.user = { _id: (this.user_id = 'user-id'), features: {} }
    this.ProjectGetter = {
      getProject: (project_id, fields, callback) => {
        if (project_id === this.project_id) {
          return callback(null, this.project)
        } else {
          return callback(null, null)
        }
      }
    }
    this.UserGetter = {
      getUser: (user_id, filter, callback) => {
        if (user_id === this.user_id) {
          return callback(null, this.user)
        } else {
          return callback(null, null)
        }
      }
    }

    this.SubscriptionLocator = {
      getUsersSubscription: sinon.stub(),
      getSubscription: sinon.stub()
    }

    return (this.LimitationsManager = SandboxedModule.require(modulePath, {
      globals: {
        console: console
      },
      requires: {
        '../Project/ProjectGetter': this.ProjectGetter,
        '../User/UserGetter': this.UserGetter,
        './SubscriptionLocator': this.SubscriptionLocator,
        'settings-sharelatex': (this.Settings = {}),
        '../Collaborators/CollaboratorsHandler': (this.CollaboratorsHandler = {}),
        '../Collaborators/CollaboratorsInviteHandler': (this.CollaboratorsInviteHandler = {}),
        './V1SubscriptionManager': (this.V1SubscriptionManager = {}),
        'logger-sharelatex': {
          log() {}
        }
      }
    }))
  })

  describe('allowedNumberOfCollaboratorsInProject', function() {
    describe('when the project is owned by a user without a subscription', function() {
      beforeEach(function() {
        this.Settings.defaultFeatures = { collaborators: 23 }
        this.project.owner_ref = this.user_id
        delete this.user.features
        this.callback = sinon.stub()
        return this.LimitationsManager.allowedNumberOfCollaboratorsInProject(
          this.project_id,
          this.callback
        )
      })

      it('should return the default number', function() {
        return this.callback
          .calledWith(null, this.Settings.defaultFeatures.collaborators)
          .should.equal(true)
      })
    })

    describe('when the project is owned by a user with a subscription', function() {
      beforeEach(function() {
        this.project.owner_ref = this.user_id
        this.user.features = { collaborators: 21 }
        this.callback = sinon.stub()
        return this.LimitationsManager.allowedNumberOfCollaboratorsInProject(
          this.project_id,
          this.callback
        )
      })

      it('should return the number of collaborators the user is allowed', function() {
        return this.callback
          .calledWith(null, this.user.features.collaborators)
          .should.equal(true)
      })
    })
  })

  describe('allowedNumberOfCollaboratorsForUser', function() {
    describe('when the user has no features', function() {
      beforeEach(function() {
        this.Settings.defaultFeatures = { collaborators: 23 }
        delete this.user.features
        this.callback = sinon.stub()
        return this.LimitationsManager.allowedNumberOfCollaboratorsForUser(
          this.user_id,
          this.callback
        )
      })

      it('should return the default number', function() {
        return this.callback
          .calledWith(null, this.Settings.defaultFeatures.collaborators)
          .should.equal(true)
      })
    })

    describe('when the user has features', function() {
      beforeEach(function() {
        this.user.features = { collaborators: 21 }
        this.callback = sinon.stub()
        return this.LimitationsManager.allowedNumberOfCollaboratorsForUser(
          this.user_id,
          this.callback
        )
      })

      it('should return the number of collaborators the user is allowed', function() {
        return this.callback
          .calledWith(null, this.user.features.collaborators)
          .should.equal(true)
      })
    })
  })

  describe('canAddXCollaborators', function() {
    describe('when the project has fewer collaborators than allowed', function() {
      beforeEach(function() {
        this.current_number = 1
        this.allowed_number = 2
        this.invite_count = 0
        this.CollaboratorsHandler.getInvitedCollaboratorCount = (
          project_id,
          callback
        ) => callback(null, this.current_number)
        this.CollaboratorsInviteHandler.getInviteCount = (
          project_id,
          callback
        ) => callback(null, this.invite_count)
        sinon.stub(
          this.LimitationsManager,
          'allowedNumberOfCollaboratorsInProject',
          (project_id, callback) => {
            return callback(null, this.allowed_number)
          }
        )
        this.callback = sinon.stub()
        return this.LimitationsManager.canAddXCollaborators(
          this.project_id,
          1,
          this.callback
        )
      })

      it('should return true', function() {
        return this.callback.calledWith(null, true).should.equal(true)
      })
    })

    describe('when the project has fewer collaborators and invites than allowed', function() {
      beforeEach(function() {
        this.current_number = 1
        this.allowed_number = 4
        this.invite_count = 1
        this.CollaboratorsHandler.getInvitedCollaboratorCount = (
          project_id,
          callback
        ) => callback(null, this.current_number)
        this.CollaboratorsInviteHandler.getInviteCount = (
          project_id,
          callback
        ) => callback(null, this.invite_count)
        sinon.stub(
          this.LimitationsManager,
          'allowedNumberOfCollaboratorsInProject',
          (project_id, callback) => {
            return callback(null, this.allowed_number)
          }
        )
        this.callback = sinon.stub()
        return this.LimitationsManager.canAddXCollaborators(
          this.project_id,
          1,
          this.callback
        )
      })

      it('should return true', function() {
        return this.callback.calledWith(null, true).should.equal(true)
      })
    })

    describe('when the project has fewer collaborators than allowed but I want to add more than allowed', function() {
      beforeEach(function() {
        this.current_number = 1
        this.allowed_number = 2
        this.invite_count = 0
        this.CollaboratorsHandler.getInvitedCollaboratorCount = (
          project_id,
          callback
        ) => callback(null, this.current_number)
        this.CollaboratorsInviteHandler.getInviteCount = (
          project_id,
          callback
        ) => callback(null, this.invite_count)
        sinon.stub(
          this.LimitationsManager,
          'allowedNumberOfCollaboratorsInProject',
          (project_id, callback) => {
            return callback(null, this.allowed_number)
          }
        )
        this.callback = sinon.stub()
        return this.LimitationsManager.canAddXCollaborators(
          this.project_id,
          2,
          this.callback
        )
      })

      it('should return false', function() {
        return this.callback.calledWith(null, false).should.equal(true)
      })
    })

    describe('when the project has more collaborators than allowed', function() {
      beforeEach(function() {
        this.current_number = 3
        this.allowed_number = 2
        this.invite_count = 0
        this.CollaboratorsHandler.getInvitedCollaboratorCount = (
          project_id,
          callback
        ) => callback(null, this.current_number)
        this.CollaboratorsInviteHandler.getInviteCount = (
          project_id,
          callback
        ) => callback(null, this.invite_count)
        sinon.stub(
          this.LimitationsManager,
          'allowedNumberOfCollaboratorsInProject',
          (project_id, callback) => {
            return callback(null, this.allowed_number)
          }
        )
        this.callback = sinon.stub()
        return this.LimitationsManager.canAddXCollaborators(
          this.project_id,
          1,
          this.callback
        )
      })

      it('should return false', function() {
        return this.callback.calledWith(null, false).should.equal(true)
      })
    })

    describe('when the project has infinite collaborators', function() {
      beforeEach(function() {
        this.current_number = 100
        this.allowed_number = -1
        this.invite_count = 0
        this.CollaboratorsHandler.getInvitedCollaboratorCount = (
          project_id,
          callback
        ) => callback(null, this.current_number)
        this.CollaboratorsInviteHandler.getInviteCount = (
          project_id,
          callback
        ) => callback(null, this.invite_count)
        sinon.stub(
          this.LimitationsManager,
          'allowedNumberOfCollaboratorsInProject',
          (project_id, callback) => {
            return callback(null, this.allowed_number)
          }
        )
        this.callback = sinon.stub()
        return this.LimitationsManager.canAddXCollaborators(
          this.project_id,
          1,
          this.callback
        )
      })

      it('should return true', function() {
        return this.callback.calledWith(null, true).should.equal(true)
      })
    })

    describe('when the project has more invites than allowed', function() {
      beforeEach(function() {
        this.current_number = 0
        this.allowed_number = 2
        this.invite_count = 2
        this.CollaboratorsHandler.getInvitedCollaboratorCount = (
          project_id,
          callback
        ) => callback(null, this.current_number)
        this.CollaboratorsInviteHandler.getInviteCount = (
          project_id,
          callback
        ) => callback(null, this.invite_count)
        sinon.stub(
          this.LimitationsManager,
          'allowedNumberOfCollaboratorsInProject',
          (project_id, callback) => {
            return callback(null, this.allowed_number)
          }
        )
        this.callback = sinon.stub()
        return this.LimitationsManager.canAddXCollaborators(
          this.project_id,
          1,
          this.callback
        )
      })

      it('should return false', function() {
        return this.callback.calledWith(null, false).should.equal(true)
      })
    })

    describe('when the project has more invites and collaborators than allowed', function() {
      beforeEach(function() {
        this.current_number = 1
        this.allowed_number = 2
        this.invite_count = 1
        this.CollaboratorsHandler.getInvitedCollaboratorCount = (
          project_id,
          callback
        ) => callback(null, this.current_number)
        this.CollaboratorsInviteHandler.getInviteCount = (
          project_id,
          callback
        ) => callback(null, this.invite_count)
        sinon.stub(
          this.LimitationsManager,
          'allowedNumberOfCollaboratorsInProject',
          (project_id, callback) => {
            return callback(null, this.allowed_number)
          }
        )
        this.callback = sinon.stub()
        return this.LimitationsManager.canAddXCollaborators(
          this.project_id,
          1,
          this.callback
        )
      })

      it('should return false', function() {
        return this.callback.calledWith(null, false).should.equal(true)
      })
    })
  })

  describe('userHasV2Subscription', function() {
    beforeEach(function() {
      return (this.SubscriptionLocator.getUsersSubscription = sinon.stub())
    })

    it('should return true if the recurly token is set', function(done) {
      this.SubscriptionLocator.getUsersSubscription.callsArgWith(1, null, {
        recurlySubscription_id: '1234'
      })
      return this.LimitationsManager.userHasV2Subscription(
        this.user,
        (err, hasSubscription) => {
          hasSubscription.should.equal(true)
          return done()
        }
      )
    })

    it('should return false if the recurly token is not set', function(done) {
      this.SubscriptionLocator.getUsersSubscription.callsArgWith(1, null, {})
      this.subscription = {}
      return this.LimitationsManager.userHasV2Subscription(
        this.user,
        (err, hasSubscription) => {
          hasSubscription.should.equal(false)
          return done()
        }
      )
    })

    it('should return false if the subscription is undefined', function(done) {
      this.SubscriptionLocator.getUsersSubscription.callsArgWith(1)
      return this.LimitationsManager.userHasV2Subscription(
        this.user,
        (err, hasSubscription) => {
          hasSubscription.should.equal(false)
          return done()
        }
      )
    })

    it('should return the subscription', function(done) {
      const stubbedSubscription = { freeTrial: {}, token: '' }
      this.SubscriptionLocator.getUsersSubscription.callsArgWith(
        1,
        null,
        stubbedSubscription
      )
      return this.LimitationsManager.userHasV2Subscription(
        this.user,
        (err, hasSubOrIsGroupMember, subscription) => {
          subscription.should.deep.equal(stubbedSubscription)
          return done()
        }
      )
    })

    describe('when user has a custom account', function() {
      beforeEach(function() {
        this.fakeSubscription = { customAccount: true }
        return this.SubscriptionLocator.getUsersSubscription.callsArgWith(
          1,
          null,
          this.fakeSubscription
        )
      })

      it('should return true', function(done) {
        return this.LimitationsManager.userHasV2Subscription(
          this.user,
          (err, hasSubscription, subscription) => {
            hasSubscription.should.equal(true)
            return done()
          }
        )
      })

      it('should return the subscription', function(done) {
        return this.LimitationsManager.userHasV2Subscription(
          this.user,
          (err, hasSubscription, subscription) => {
            subscription.should.deep.equal(this.fakeSubscription)
            return done()
          }
        )
      })
    })
  })

  describe('userIsMemberOfGroupSubscription', function() {
    beforeEach(function() {
      return (this.SubscriptionLocator.getMemberSubscriptions = sinon.stub())
    })

    it('should return false if there are no groups subcriptions', function(done) {
      this.SubscriptionLocator.getMemberSubscriptions.callsArgWith(1, null, [])
      return this.LimitationsManager.userIsMemberOfGroupSubscription(
        this.user,
        (err, isMember) => {
          isMember.should.equal(false)
          return done()
        }
      )
    })

    it('should return true if there are no groups subcriptions', function(done) {
      let subscriptions
      this.SubscriptionLocator.getMemberSubscriptions.callsArgWith(
        1,
        null,
        (subscriptions = ['mock-subscription'])
      )
      return this.LimitationsManager.userIsMemberOfGroupSubscription(
        this.user,
        (err, isMember, retSubscriptions) => {
          isMember.should.equal(true)
          retSubscriptions.should.equal(subscriptions)
          return done()
        }
      )
    })
  })

  describe('hasPaidSubscription', function() {
    beforeEach(function() {
      this.LimitationsManager.userIsMemberOfGroupSubscription = sinon
        .stub()
        .yields(null, false)
      this.LimitationsManager.userHasV2Subscription = sinon
        .stub()
        .yields(null, false)
      return (this.LimitationsManager.userHasV1Subscription = sinon
        .stub()
        .yields(null, false))
    })

    it('should return true if userIsMemberOfGroupSubscription', function(done) {
      this.LimitationsManager.userIsMemberOfGroupSubscription = sinon
        .stub()
        .yields(null, true)
      return this.LimitationsManager.hasPaidSubscription(
        this.user,
        (err, hasSubOrIsGroupMember) => {
          hasSubOrIsGroupMember.should.equal(true)
          return done()
        }
      )
    })

    it('should return true if userHasV2Subscription', function(done) {
      this.LimitationsManager.userHasV2Subscription = sinon
        .stub()
        .yields(null, true)
      return this.LimitationsManager.hasPaidSubscription(
        this.user,
        (err, hasSubOrIsGroupMember) => {
          hasSubOrIsGroupMember.should.equal(true)
          return done()
        }
      )
    })

    it('should return true if userHasV1Subscription', function(done) {
      this.LimitationsManager.userHasV1Subscription = sinon
        .stub()
        .yields(null, true)
      return this.LimitationsManager.hasPaidSubscription(
        this.user,
        (err, hasSubOrIsGroupMember) => {
          hasSubOrIsGroupMember.should.equal(true)
          return done()
        }
      )
    })

    it('should return false if none are true', function(done) {
      return this.LimitationsManager.hasPaidSubscription(
        this.user,
        (err, hasSubOrIsGroupMember) => {
          hasSubOrIsGroupMember.should.equal(false)
          return done()
        }
      )
    })

    it('should have userHasSubscriptionOrIsGroupMember alias', function(done) {
      return this.LimitationsManager.userHasSubscriptionOrIsGroupMember(
        this.user,
        (err, hasSubOrIsGroupMember) => {
          hasSubOrIsGroupMember.should.equal(false)
          return done()
        }
      )
    })
  })

  describe('userHasV1OrV2Subscription', function() {
    beforeEach(function() {
      this.LimitationsManager.userHasV2Subscription = sinon
        .stub()
        .yields(null, false)
      return (this.LimitationsManager.userHasV1Subscription = sinon
        .stub()
        .yields(null, false))
    })

    it('should return true if userHasV2Subscription', function(done) {
      this.LimitationsManager.userHasV2Subscription = sinon
        .stub()
        .yields(null, true)
      return this.LimitationsManager.userHasV1OrV2Subscription(
        this.user,
        (err, hasSub) => {
          hasSub.should.equal(true)
          return done()
        }
      )
    })

    it('should return true if userHasV1Subscription', function(done) {
      this.LimitationsManager.userHasV1Subscription = sinon
        .stub()
        .yields(null, true)
      return this.LimitationsManager.userHasV1OrV2Subscription(
        this.user,
        (err, hasSub) => {
          hasSub.should.equal(true)
          return done()
        }
      )
    })

    it('should return false if none are true', function(done) {
      return this.LimitationsManager.userHasV1OrV2Subscription(
        this.user,
        (err, hasSub) => {
          hasSub.should.equal(false)
          return done()
        }
      )
    })
  })

  describe('hasGroupMembersLimitReached', function() {
    beforeEach(function() {
      this.subscriptionId = '12312'
      return (this.subscription = {
        membersLimit: 3,
        member_ids: ['', ''],
        teamInvites: [
          { email: 'bob@example.com', sentAt: new Date(), token: 'hey' }
        ]
      })
    })

    it('should return true if the limit is hit (including members and invites)', function(done) {
      this.SubscriptionLocator.getSubscription.callsArgWith(
        1,
        null,
        this.subscription
      )
      return this.LimitationsManager.hasGroupMembersLimitReached(
        this.subscriptionId,
        (err, limitReached) => {
          limitReached.should.equal(true)
          return done()
        }
      )
    })

    it('should return false if the limit is not hit (including members and invites)', function(done) {
      this.subscription.membersLimit = 4
      this.SubscriptionLocator.getSubscription.callsArgWith(
        1,
        null,
        this.subscription
      )
      return this.LimitationsManager.hasGroupMembersLimitReached(
        this.subscriptionId,
        (err, limitReached) => {
          limitReached.should.equal(false)
          return done()
        }
      )
    })

    it('should return true if the limit has been exceded (including members and invites)', function(done) {
      this.subscription.membersLimit = 2
      this.SubscriptionLocator.getSubscription.callsArgWith(
        1,
        null,
        this.subscription
      )
      return this.LimitationsManager.hasGroupMembersLimitReached(
        this.subscriptionId,
        (err, limitReached) => {
          limitReached.should.equal(true)
          return done()
        }
      )
    })
  })

  describe('userHasV1Subscription', function() {
    it('should return true if v1 returns has_subscription = true', function(done) {
      this.V1SubscriptionManager.getSubscriptionsFromV1 = sinon
        .stub()
        .yields(null, { has_subscription: true })
      return this.LimitationsManager.userHasV1Subscription(
        this.user,
        (error, result) => {
          this.V1SubscriptionManager.getSubscriptionsFromV1
            .calledWith(this.user_id)
            .should.equal(true)
          result.should.equal(true)
          return done()
        }
      )
    })

    it('should return false if v1 returns has_subscription = false', function(done) {
      this.V1SubscriptionManager.getSubscriptionsFromV1 = sinon
        .stub()
        .yields(null, { has_subscription: false })
      return this.LimitationsManager.userHasV1Subscription(
        this.user,
        (error, result) => {
          this.V1SubscriptionManager.getSubscriptionsFromV1
            .calledWith(this.user_id)
            .should.equal(true)
          result.should.equal(false)
          return done()
        }
      )
    })

    it('should return false if v1 returns nothing', function(done) {
      this.V1SubscriptionManager.getSubscriptionsFromV1 = sinon
        .stub()
        .yields(null, null)
      return this.LimitationsManager.userHasV1Subscription(
        this.user,
        (error, result) => {
          this.V1SubscriptionManager.getSubscriptionsFromV1
            .calledWith(this.user_id)
            .should.equal(true)
          result.should.equal(false)
          return done()
        }
      )
    })
  })
})
