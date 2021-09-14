const SandboxedModule = require('sandboxed-module')
const assert = require('assert')
const sinon = require('sinon')
const modulePath = require('path').join(
  __dirname,
  '../../../../app/src/Features/Subscription/LimitationsManager'
)

describe('LimitationsManager', function () {
  beforeEach(function () {
    this.project = { _id: (this.projectId = 'project-id') }
    this.user = { _id: (this.userId = 'user-id'), features: {} }
    this.ProjectGetter = {
      getProject: (projectId, fields, callback) => {
        if (projectId === this.projectId) {
          callback(null, this.project)
        } else {
          callback(null, null)
        }
      },
    }
    this.UserGetter = {
      getUser: (userId, filter, callback) => {
        if (userId === this.userId) {
          callback(null, this.user)
        } else {
          callback(null, null)
        }
      },
    }

    this.SubscriptionLocator = {
      getUsersSubscription: sinon.stub(),
      getSubscription: sinon.stub(),
    }

    this.LimitationsManager = SandboxedModule.require(modulePath, {
      requires: {
        '../Project/ProjectGetter': this.ProjectGetter,
        '../User/UserGetter': this.UserGetter,
        './SubscriptionLocator': this.SubscriptionLocator,
        '@overleaf/settings': (this.Settings = {}),
        '../Collaborators/CollaboratorsGetter': (this.CollaboratorsGetter = {}),
        '../Collaborators/CollaboratorsInviteHandler': (this.CollaboratorsInviteHandler = {}),
        './V1SubscriptionManager': (this.V1SubscriptionManager = {}),
      },
    })
  })

  describe('allowedNumberOfCollaboratorsInProject', function () {
    describe('when the project is owned by a user without a subscription', function () {
      beforeEach(function () {
        this.Settings.defaultFeatures = { collaborators: 23 }
        this.project.owner_ref = this.userId
        delete this.user.features
        this.callback = sinon.stub()
        this.LimitationsManager.allowedNumberOfCollaboratorsInProject(
          this.projectId,
          this.callback
        )
      })

      it('should return the default number', function () {
        this.callback
          .calledWith(null, this.Settings.defaultFeatures.collaborators)
          .should.equal(true)
      })
    })

    describe('when the project is owned by a user with a subscription', function () {
      beforeEach(function () {
        this.project.owner_ref = this.userId
        this.user.features = { collaborators: 21 }
        this.callback = sinon.stub()
        this.LimitationsManager.allowedNumberOfCollaboratorsInProject(
          this.projectId,
          this.callback
        )
      })

      it('should return the number of collaborators the user is allowed', function () {
        this.callback
          .calledWith(null, this.user.features.collaborators)
          .should.equal(true)
      })
    })
  })

  describe('allowedNumberOfCollaboratorsForUser', function () {
    describe('when the user has no features', function () {
      beforeEach(function () {
        this.Settings.defaultFeatures = { collaborators: 23 }
        delete this.user.features
        this.callback = sinon.stub()
        this.LimitationsManager.allowedNumberOfCollaboratorsForUser(
          this.userId,
          this.callback
        )
      })

      it('should return the default number', function () {
        this.callback
          .calledWith(null, this.Settings.defaultFeatures.collaborators)
          .should.equal(true)
      })
    })

    describe('when the user has features', function () {
      beforeEach(function () {
        this.user.features = { collaborators: 21 }
        this.callback = sinon.stub()
        this.LimitationsManager.allowedNumberOfCollaboratorsForUser(
          this.userId,
          this.callback
        )
      })

      it('should return the number of collaborators the user is allowed', function () {
        this.callback
          .calledWith(null, this.user.features.collaborators)
          .should.equal(true)
      })
    })
  })

  describe('canAddXCollaborators', function () {
    describe('when the project has fewer collaborators than allowed', function () {
      beforeEach(function () {
        this.current_number = 1
        this.allowed_number = 2
        this.invite_count = 0
        this.CollaboratorsGetter.getInvitedCollaboratorCount = (
          projectId,
          callback
        ) => callback(null, this.current_number)
        this.CollaboratorsInviteHandler.getInviteCount = (
          projectId,
          callback
        ) => callback(null, this.invite_count)
        sinon
          .stub(
            this.LimitationsManager,
            'allowedNumberOfCollaboratorsInProject'
          )
          .callsFake((projectId, callback) => {
            callback(null, this.allowed_number)
          })
        this.callback = sinon.stub()
        this.LimitationsManager.canAddXCollaborators(
          this.projectId,
          1,
          this.callback
        )
      })

      it('should return true', function () {
        this.callback.calledWith(null, true).should.equal(true)
      })
    })

    describe('when the project has fewer collaborators and invites than allowed', function () {
      beforeEach(function () {
        this.current_number = 1
        this.allowed_number = 4
        this.invite_count = 1
        this.CollaboratorsGetter.getInvitedCollaboratorCount = (
          projectId,
          callback
        ) => callback(null, this.current_number)
        this.CollaboratorsInviteHandler.getInviteCount = (
          projectId,
          callback
        ) => callback(null, this.invite_count)
        sinon
          .stub(
            this.LimitationsManager,
            'allowedNumberOfCollaboratorsInProject'
          )
          .callsFake((projectId, callback) => {
            callback(null, this.allowed_number)
          })
        this.callback = sinon.stub()
        this.LimitationsManager.canAddXCollaborators(
          this.projectId,
          1,
          this.callback
        )
      })

      it('should return true', function () {
        this.callback.calledWith(null, true).should.equal(true)
      })
    })

    describe('when the project has fewer collaborators than allowed but I want to add more than allowed', function () {
      beforeEach(function () {
        this.current_number = 1
        this.allowed_number = 2
        this.invite_count = 0
        this.CollaboratorsGetter.getInvitedCollaboratorCount = (
          projectId,
          callback
        ) => callback(null, this.current_number)
        this.CollaboratorsInviteHandler.getInviteCount = (
          projectId,
          callback
        ) => callback(null, this.invite_count)
        sinon
          .stub(
            this.LimitationsManager,
            'allowedNumberOfCollaboratorsInProject'
          )
          .callsFake((projectId, callback) => {
            callback(null, this.allowed_number)
          })
        this.callback = sinon.stub()
        this.LimitationsManager.canAddXCollaborators(
          this.projectId,
          2,
          this.callback
        )
      })

      it('should return false', function () {
        this.callback.calledWith(null, false).should.equal(true)
      })
    })

    describe('when the project has more collaborators than allowed', function () {
      beforeEach(function () {
        this.current_number = 3
        this.allowed_number = 2
        this.invite_count = 0
        this.CollaboratorsGetter.getInvitedCollaboratorCount = (
          projectId,
          callback
        ) => callback(null, this.current_number)
        this.CollaboratorsInviteHandler.getInviteCount = (
          projectId,
          callback
        ) => callback(null, this.invite_count)
        sinon
          .stub(
            this.LimitationsManager,
            'allowedNumberOfCollaboratorsInProject'
          )
          .callsFake((projectId, callback) => {
            callback(null, this.allowed_number)
          })
        this.callback = sinon.stub()
        this.LimitationsManager.canAddXCollaborators(
          this.projectId,
          1,
          this.callback
        )
      })

      it('should return false', function () {
        this.callback.calledWith(null, false).should.equal(true)
      })
    })

    describe('when the project has infinite collaborators', function () {
      beforeEach(function () {
        this.current_number = 100
        this.allowed_number = -1
        this.invite_count = 0
        this.CollaboratorsGetter.getInvitedCollaboratorCount = (
          projectId,
          callback
        ) => callback(null, this.current_number)
        this.CollaboratorsInviteHandler.getInviteCount = (
          projectId,
          callback
        ) => callback(null, this.invite_count)
        sinon
          .stub(
            this.LimitationsManager,
            'allowedNumberOfCollaboratorsInProject'
          )
          .callsFake((projectId, callback) => {
            callback(null, this.allowed_number)
          })
        this.callback = sinon.stub()
        this.LimitationsManager.canAddXCollaborators(
          this.projectId,
          1,
          this.callback
        )
      })

      it('should return true', function () {
        this.callback.calledWith(null, true).should.equal(true)
      })
    })

    describe('when the project has more invites than allowed', function () {
      beforeEach(function () {
        this.current_number = 0
        this.allowed_number = 2
        this.invite_count = 2
        this.CollaboratorsGetter.getInvitedCollaboratorCount = (
          projectId,
          callback
        ) => callback(null, this.current_number)
        this.CollaboratorsInviteHandler.getInviteCount = (
          projectId,
          callback
        ) => callback(null, this.invite_count)
        sinon
          .stub(
            this.LimitationsManager,
            'allowedNumberOfCollaboratorsInProject'
          )
          .callsFake((projectId, callback) => {
            callback(null, this.allowed_number)
          })
        this.callback = sinon.stub()
        this.LimitationsManager.canAddXCollaborators(
          this.projectId,
          1,
          this.callback
        )
      })

      it('should return false', function () {
        this.callback.calledWith(null, false).should.equal(true)
      })
    })

    describe('when the project has more invites and collaborators than allowed', function () {
      beforeEach(function () {
        this.current_number = 1
        this.allowed_number = 2
        this.invite_count = 1
        this.CollaboratorsGetter.getInvitedCollaboratorCount = (
          projectId,
          callback
        ) => callback(null, this.current_number)
        this.CollaboratorsInviteHandler.getInviteCount = (
          projectId,
          callback
        ) => callback(null, this.invite_count)
        sinon
          .stub(
            this.LimitationsManager,
            'allowedNumberOfCollaboratorsInProject'
          )
          .callsFake((projectId, callback) => {
            callback(null, this.allowed_number)
          })
        this.callback = sinon.stub()
        this.LimitationsManager.canAddXCollaborators(
          this.projectId,
          1,
          this.callback
        )
      })

      it('should return false', function () {
        this.callback.calledWith(null, false).should.equal(true)
      })
    })
  })

  describe('userHasV2Subscription', function () {
    beforeEach(function () {
      this.SubscriptionLocator.getUsersSubscription = sinon.stub()
    })

    it('should return true if the recurly token is set', function (done) {
      this.SubscriptionLocator.getUsersSubscription.callsArgWith(1, null, {
        recurlySubscription_id: '1234',
      })
      this.LimitationsManager.userHasV2Subscription(
        this.user,
        (err, hasSubscription) => {
          assert.equal(err, null)
          hasSubscription.should.equal(true)
          done()
        }
      )
    })

    it('should return false if the recurly token is not set', function (done) {
      this.SubscriptionLocator.getUsersSubscription.callsArgWith(1, null, {})
      this.subscription = {}
      this.LimitationsManager.userHasV2Subscription(
        this.user,
        (err, hasSubscription) => {
          assert.equal(err, null)
          hasSubscription.should.equal(false)
          done()
        }
      )
    })

    it('should return false if the subscription is undefined', function (done) {
      this.SubscriptionLocator.getUsersSubscription.callsArgWith(1)
      this.LimitationsManager.userHasV2Subscription(
        this.user,
        (err, hasSubscription) => {
          assert.equal(err, null)
          hasSubscription.should.equal(false)
          done()
        }
      )
    })

    it('should return the subscription', function (done) {
      const stubbedSubscription = { freeTrial: {}, token: '' }
      this.SubscriptionLocator.getUsersSubscription.callsArgWith(
        1,
        null,
        stubbedSubscription
      )
      this.LimitationsManager.userHasV2Subscription(
        this.user,
        (err, hasSubOrIsGroupMember, subscription) => {
          assert.equal(err, null)
          subscription.should.deep.equal(stubbedSubscription)
          done()
        }
      )
    })

    describe('when user has a custom account', function () {
      beforeEach(function () {
        this.fakeSubscription = { customAccount: true }
        this.SubscriptionLocator.getUsersSubscription.callsArgWith(
          1,
          null,
          this.fakeSubscription
        )
      })

      it('should return true', function (done) {
        this.LimitationsManager.userHasV2Subscription(
          this.user,
          (err, hasSubscription, subscription) => {
            assert.equal(err, null)
            hasSubscription.should.equal(true)
            done()
          }
        )
      })

      it('should return the subscription', function (done) {
        this.LimitationsManager.userHasV2Subscription(
          this.user,
          (err, hasSubscription, subscription) => {
            assert.equal(err, null)
            subscription.should.deep.equal(this.fakeSubscription)
            done()
          }
        )
      })
    })
  })

  describe('userIsMemberOfGroupSubscription', function () {
    beforeEach(function () {
      this.SubscriptionLocator.getMemberSubscriptions = sinon.stub()
    })

    it('should return false if there are no groups subcriptions', function (done) {
      this.SubscriptionLocator.getMemberSubscriptions.callsArgWith(1, null, [])
      this.LimitationsManager.userIsMemberOfGroupSubscription(
        this.user,
        (err, isMember) => {
          assert.equal(err, null)
          isMember.should.equal(false)
          done()
        }
      )
    })

    it('should return true if there are no groups subcriptions', function (done) {
      let subscriptions
      this.SubscriptionLocator.getMemberSubscriptions.callsArgWith(
        1,
        null,
        (subscriptions = ['mock-subscription'])
      )
      this.LimitationsManager.userIsMemberOfGroupSubscription(
        this.user,
        (err, isMember, retSubscriptions) => {
          assert.equal(err, null)
          isMember.should.equal(true)
          retSubscriptions.should.equal(subscriptions)
          done()
        }
      )
    })
  })

  describe('hasPaidSubscription', function () {
    beforeEach(function () {
      this.LimitationsManager.userIsMemberOfGroupSubscription = sinon
        .stub()
        .yields(null, false)
      this.LimitationsManager.userHasV2Subscription = sinon
        .stub()
        .yields(null, false)
      this.LimitationsManager.userHasV1Subscription = sinon
        .stub()
        .yields(null, false)
    })

    it('should return true if userIsMemberOfGroupSubscription', function (done) {
      this.LimitationsManager.userIsMemberOfGroupSubscription = sinon
        .stub()
        .yields(null, true)
      this.LimitationsManager.hasPaidSubscription(
        this.user,
        (err, hasSubOrIsGroupMember) => {
          assert.equal(err, null)
          hasSubOrIsGroupMember.should.equal(true)
          done()
        }
      )
    })

    it('should return true if userHasV2Subscription', function (done) {
      this.LimitationsManager.userHasV2Subscription = sinon
        .stub()
        .yields(null, true)
      this.LimitationsManager.hasPaidSubscription(
        this.user,
        (err, hasSubOrIsGroupMember) => {
          assert.equal(err, null)
          hasSubOrIsGroupMember.should.equal(true)
          done()
        }
      )
    })

    it('should return true if userHasV1Subscription', function (done) {
      this.LimitationsManager.userHasV1Subscription = sinon
        .stub()
        .yields(null, true)
      this.LimitationsManager.hasPaidSubscription(
        this.user,
        (err, hasSubOrIsGroupMember) => {
          assert.equal(err, null)
          hasSubOrIsGroupMember.should.equal(true)
          done()
        }
      )
    })

    it('should return false if none are true', function (done) {
      this.LimitationsManager.hasPaidSubscription(
        this.user,
        (err, hasSubOrIsGroupMember) => {
          assert.equal(err, null)
          hasSubOrIsGroupMember.should.equal(false)
          done()
        }
      )
    })

    it('should have userHasSubscriptionOrIsGroupMember alias', function (done) {
      this.LimitationsManager.userHasSubscriptionOrIsGroupMember(
        this.user,
        (err, hasSubOrIsGroupMember) => {
          assert.equal(err, null)
          hasSubOrIsGroupMember.should.equal(false)
          done()
        }
      )
    })
  })

  describe('userHasV1OrV2Subscription', function () {
    beforeEach(function () {
      this.LimitationsManager.userHasV2Subscription = sinon
        .stub()
        .yields(null, false)
      this.LimitationsManager.userHasV1Subscription = sinon
        .stub()
        .yields(null, false)
    })

    it('should return true if userHasV2Subscription', function (done) {
      this.LimitationsManager.userHasV2Subscription = sinon
        .stub()
        .yields(null, true)
      this.LimitationsManager.userHasV1OrV2Subscription(
        this.user,
        (err, hasSub) => {
          assert.equal(err, null)
          hasSub.should.equal(true)
          done()
        }
      )
    })

    it('should return true if userHasV1Subscription', function (done) {
      this.LimitationsManager.userHasV1Subscription = sinon
        .stub()
        .yields(null, true)
      this.LimitationsManager.userHasV1OrV2Subscription(
        this.user,
        (err, hasSub) => {
          assert.equal(err, null)
          hasSub.should.equal(true)
          done()
        }
      )
    })

    it('should return false if none are true', function (done) {
      this.LimitationsManager.userHasV1OrV2Subscription(
        this.user,
        (err, hasSub) => {
          assert.equal(err, null)
          hasSub.should.equal(false)
          done()
        }
      )
    })
  })

  describe('hasGroupMembersLimitReached', function () {
    beforeEach(function () {
      this.subscriptionId = '12312'
      this.subscription = {
        membersLimit: 3,
        member_ids: ['', ''],
        teamInvites: [
          { email: 'bob@example.com', sentAt: new Date(), token: 'hey' },
        ],
      }
    })

    it('should return true if the limit is hit (including members and invites)', function (done) {
      this.SubscriptionLocator.getSubscription.callsArgWith(
        1,
        null,
        this.subscription
      )
      this.LimitationsManager.hasGroupMembersLimitReached(
        this.subscriptionId,
        (err, limitReached) => {
          assert.equal(err, null)
          limitReached.should.equal(true)
          done()
        }
      )
    })

    it('should return false if the limit is not hit (including members and invites)', function (done) {
      this.subscription.membersLimit = 4
      this.SubscriptionLocator.getSubscription.callsArgWith(
        1,
        null,
        this.subscription
      )
      this.LimitationsManager.hasGroupMembersLimitReached(
        this.subscriptionId,
        (err, limitReached) => {
          assert.equal(err, null)
          limitReached.should.equal(false)
          done()
        }
      )
    })

    it('should return true if the limit has been exceded (including members and invites)', function (done) {
      this.subscription.membersLimit = 2
      this.SubscriptionLocator.getSubscription.callsArgWith(
        1,
        null,
        this.subscription
      )
      this.LimitationsManager.hasGroupMembersLimitReached(
        this.subscriptionId,
        (err, limitReached) => {
          assert.equal(err, null)
          limitReached.should.equal(true)
          done()
        }
      )
    })
  })

  describe('userHasV1Subscription', function () {
    it('should return true if v1 returns has_subscription = true', function (done) {
      this.V1SubscriptionManager.getSubscriptionsFromV1 = sinon
        .stub()
        .yields(null, { has_subscription: true })
      this.LimitationsManager.userHasV1Subscription(
        this.user,
        (error, result) => {
          assert.equal(error, null)
          this.V1SubscriptionManager.getSubscriptionsFromV1
            .calledWith(this.userId)
            .should.equal(true)
          result.should.equal(true)
          done()
        }
      )
    })

    it('should return false if v1 returns has_subscription = false', function (done) {
      this.V1SubscriptionManager.getSubscriptionsFromV1 = sinon
        .stub()
        .yields(null, { has_subscription: false })
      this.LimitationsManager.userHasV1Subscription(
        this.user,
        (error, result) => {
          assert.equal(error, null)
          this.V1SubscriptionManager.getSubscriptionsFromV1
            .calledWith(this.userId)
            .should.equal(true)
          result.should.equal(false)
          done()
        }
      )
    })

    it('should return false if v1 returns nothing', function (done) {
      this.V1SubscriptionManager.getSubscriptionsFromV1 = sinon
        .stub()
        .yields(null, null)
      this.LimitationsManager.userHasV1Subscription(
        this.user,
        (error, result) => {
          assert.equal(error, null)
          this.V1SubscriptionManager.getSubscriptionsFromV1
            .calledWith(this.userId)
            .should.equal(true)
          result.should.equal(false)
          done()
        }
      )
    })
  })
})
