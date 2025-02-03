const SandboxedModule = require('sandboxed-module')
const assert = require('assert')
const sinon = require('sinon')
const { expect } = require('chai')
const modulePath = require('path').join(
  __dirname,
  '../../../../app/src/Features/Subscription/LimitationsManager'
)

describe('LimitationsManager', function () {
  beforeEach(function () {
    this.user = {
      _id: (this.userId = 'user-id'),
      features: { collaborators: 1 },
    }
    this.project = {
      _id: (this.projectId = 'project-id'),
      owner_ref: this.userId,
    }
    this.ProjectGetter = {
      promises: {
        getProject: sinon.stub().callsFake(async (projectId, fields) => {
          if (projectId === this.projectId) {
            return this.project
          } else {
            return null
          }
        }),
      },
    }
    this.UserGetter = {
      promises: {
        getUser: sinon.stub().callsFake(async (userId, filter) => {
          if (userId === this.userId) {
            return this.user
          } else {
            return null
          }
        }),
      },
    }

    this.SubscriptionLocator = {
      promises: {
        getUsersSubscription: sinon.stub().resolves(),
        getSubscription: sinon.stub().resolves(),
        getMemberSubscriptions: sinon.stub().resolves(),
      },
    }

    this.CollaboratorsGetter = {
      promises: {
        getInvitedEditCollaboratorCount: sinon.stub().resolves(),
      },
    }

    this.CollaboratorsInviteGetter = {
      promises: {
        getEditInviteCount: sinon.stub().resolves(),
      },
    }

    this.LimitationsManager = SandboxedModule.require(modulePath, {
      requires: {
        '../Project/ProjectGetter': this.ProjectGetter,
        '../User/UserGetter': this.UserGetter,
        './SubscriptionLocator': this.SubscriptionLocator,
        '@overleaf/settings': (this.Settings = {}),
        '../Collaborators/CollaboratorsGetter': this.CollaboratorsGetter,
        '../Collaborators/CollaboratorsInviteGetter':
          this.CollaboratorsInviteGetter,
        './V1SubscriptionManager': this.V1SubscriptionManager,
      },
    })
  })

  describe('allowedNumberOfCollaboratorsInProject', function () {
    describe('when the project is owned by a user without a subscription', function () {
      beforeEach(function (done) {
        this.Settings.defaultFeatures = { collaborators: 23 }
        this.project.owner_ref = this.userId
        delete this.user.features
        this.callback = sinon.stub().callsFake(() => done())
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
      beforeEach(function (done) {
        this.project.owner_ref = this.userId
        this.user.features = { collaborators: 21 }
        this.callback = sinon.stub().callsFake(() => done())
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
      beforeEach(function (done) {
        this.Settings.defaultFeatures = { collaborators: 23 }
        delete this.user.features
        this.callback = sinon.stub().callsFake(() => done())
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
      beforeEach(function (done) {
        this.user.features = { collaborators: 21 }
        this.callback = sinon.stub().callsFake(() => done())
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

  describe('canAcceptEditCollaboratorInvite', function () {
    describe('when the project has fewer collaborators than allowed', function () {
      beforeEach(function () {
        this.current_number = 1
        this.user.features.collaborators = 2
        this.CollaboratorsGetter.promises.getInvitedEditCollaboratorCount =
          sinon.stub().resolves(this.current_number)
      })

      it('should return true', async function () {
        const result =
          await this.LimitationsManager.promises.canAcceptEditCollaboratorInvite(
            this.projectId
          )
        expect(result).to.be.true
      })
    })

    describe('when accepting the invite would exceed the collaborator limit', function () {
      beforeEach(function () {
        this.current_number = 2
        this.user.features.collaborators = 2
        this.CollaboratorsGetter.promises.getInvitedEditCollaboratorCount =
          sinon.stub().resolves(this.current_number)
      })

      it('should return false', async function () {
        const result =
          await this.LimitationsManager.promises.canAcceptEditCollaboratorInvite(
            this.projectId
          )
        expect(result).to.be.false
      })
    })

    describe('when the project has more collaborators than allowed', function () {
      beforeEach(function () {
        this.current_number = 3
        this.user.features.collaborators = 2
        this.CollaboratorsGetter.promises.getInvitedEditCollaboratorCount =
          sinon.stub().resolves(this.current_number)
      })

      it('should return false', async function () {
        const result =
          await this.LimitationsManager.promises.canAcceptEditCollaboratorInvite(
            this.projectId
          )
        expect(result).to.be.false
      })
    })

    describe('when the project has infinite collaborators', function () {
      beforeEach(function () {
        this.current_number = 100
        this.user.features.collaborators = -1
        this.CollaboratorsGetter.promises.getInvitedEditCollaboratorCount =
          sinon.stub().resolves(this.current_number)
      })

      it('should return true', async function () {
        const result =
          await this.LimitationsManager.promises.canAcceptEditCollaboratorInvite(
            this.projectId
          )
        expect(result).to.be.true
      })
    })
  })

  describe('canAddXEditCollaborators', function () {
    describe('when the project has fewer collaborators than allowed', function () {
      beforeEach(function (done) {
        this.current_number = 1
        this.user.features.collaborators = 2
        this.invite_count = 0
        this.CollaboratorsGetter.promises.getInvitedEditCollaboratorCount =
          sinon.stub().resolves(this.current_number)
        this.CollaboratorsInviteGetter.promises.getEditInviteCount = sinon
          .stub()
          .resolves(this.invite_count)
        this.callback = sinon.stub().callsFake(() => done())
        this.LimitationsManager.canAddXEditCollaborators(
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
      beforeEach(function (done) {
        this.current_number = 1
        this.user.features.collaborators = 4
        this.invite_count = 1
        this.CollaboratorsGetter.promises.getInvitedEditCollaboratorCount =
          sinon.stub().resolves(this.current_number)
        this.CollaboratorsInviteGetter.promises.getEditInviteCount = sinon
          .stub()
          .resolves(this.invite_count)
        this.callback = sinon.stub().callsFake(() => done())
        this.LimitationsManager.canAddXEditCollaborators(
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
      beforeEach(function (done) {
        this.current_number = 1
        this.user.features.collaborators = 2
        this.invite_count = 0
        this.CollaboratorsGetter.promises.getInvitedEditCollaboratorCount =
          sinon.stub().resolves(this.current_number)
        this.CollaboratorsInviteGetter.promises.getEditInviteCount = sinon
          .stub()
          .resolves(this.invite_count)
        this.callback = sinon.stub().callsFake(() => done())
        this.LimitationsManager.canAddXEditCollaborators(
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
      beforeEach(function (done) {
        this.current_number = 3
        this.user.features.collaborators = 2
        this.invite_count = 0
        this.CollaboratorsGetter.promises.getInvitedEditCollaboratorCount =
          sinon.stub().resolves(this.current_number)
        this.CollaboratorsInviteGetter.promises.getEditInviteCount = sinon
          .stub()
          .resolves(this.invite_count)
        this.callback = sinon.stub().callsFake(() => done())
        this.LimitationsManager.canAddXEditCollaborators(
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
      beforeEach(function (done) {
        this.current_number = 100
        this.user.features.collaborators = -1
        this.invite_count = 0
        this.CollaboratorsGetter.promises.getInvitedEditCollaboratorCount =
          sinon.stub().resolves(this.current_number)
        this.CollaboratorsInviteGetter.promises.getEditInviteCount = sinon
          .stub()
          .resolves(this.invite_count)
        this.callback = sinon.stub().callsFake(() => done())
        this.LimitationsManager.canAddXEditCollaborators(
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
      beforeEach(function (done) {
        this.current_number = 0
        this.user.features.collaborators = 2
        this.invite_count = 2
        this.CollaboratorsGetter.promises.getInvitedEditCollaboratorCount =
          sinon.stub().resolves(this.current_number)
        this.CollaboratorsInviteGetter.promises.getEditInviteCount = sinon
          .stub()
          .resolves(this.invite_count)
        this.callback = sinon.stub().callsFake(() => done())
        this.LimitationsManager.canAddXEditCollaborators(
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
      beforeEach(function (done) {
        this.current_number = 1
        this.user.features.collaborators = 2
        this.invite_count = 1
        this.CollaboratorsGetter.promises.getInvitedEditCollaboratorCount =
          sinon.stub().resolves(this.current_number)
        this.CollaboratorsInviteGetter.promises.getEditInviteCount = sinon
          .stub()
          .resolves(this.invite_count)
        this.callback = sinon.stub().callsFake(() => done())
        this.LimitationsManager.canAddXEditCollaborators(
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

  describe('userHasSubscription', function () {
    beforeEach(function () {
      this.SubscriptionLocator.promises.getUsersSubscription = sinon
        .stub()
        .resolves()
    })

    it('should return true if the recurly token is set', function (done) {
      this.SubscriptionLocator.promises.getUsersSubscription = sinon
        .stub()
        .resolves({
          recurlySubscription_id: '1234',
        })
      this.LimitationsManager.userHasSubscription(
        this.user,
        (err, hasSubscription) => {
          assert.equal(err, null)
          hasSubscription.should.equal(true)
          done()
        }
      )
    })

    it('should return false if the recurly token is not set', function (done) {
      this.SubscriptionLocator.promises.getUsersSubscription.resolves({})
      this.subscription = {}
      this.LimitationsManager.userHasSubscription(
        this.user,
        (err, hasSubscription) => {
          assert.equal(err, null)
          hasSubscription.should.equal(false)
          done()
        }
      )
    })

    it('should return false if the subscription is undefined', function (done) {
      this.SubscriptionLocator.promises.getUsersSubscription.resolves()
      this.LimitationsManager.userHasSubscription(
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
      this.SubscriptionLocator.promises.getUsersSubscription.resolves(
        stubbedSubscription
      )
      this.LimitationsManager.userHasSubscription(
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
        this.SubscriptionLocator.promises.getUsersSubscription.resolves(
          this.fakeSubscription
        )
      })

      it('should return true', function (done) {
        this.LimitationsManager.userHasSubscription(
          this.user,
          (err, hasSubscription, subscription) => {
            assert.equal(err, null)
            hasSubscription.should.equal(true)
            done()
          }
        )
      })

      it('should return the subscription', function (done) {
        this.LimitationsManager.userHasSubscription(
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
      this.SubscriptionLocator.promises.getMemberSubscriptions = sinon
        .stub()
        .resolves()
    })

    it('should return false if there are no groups subcriptions', function (done) {
      this.SubscriptionLocator.promises.getMemberSubscriptions.resolves([])
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
      this.SubscriptionLocator.promises.getMemberSubscriptions.resolves(
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
      this.SubscriptionLocator.promises.getMemberSubscriptions = sinon
        .stub()
        .resolves([])
      this.SubscriptionLocator.promises.getUsersSubscription = sinon
        .stub()
        .resolves(null)
    })

    it('should return true if userIsMemberOfGroupSubscription', function (done) {
      this.SubscriptionLocator.promises.getMemberSubscriptions = sinon
        .stub()
        .resolves([{ _id: '123' }])
      this.LimitationsManager.hasPaidSubscription(
        this.user,
        (err, hasSubOrIsGroupMember) => {
          assert.equal(err, null)
          hasSubOrIsGroupMember.should.equal(true)
          done()
        }
      )
    })

    it('should return true if userHasSubscription', function (done) {
      this.SubscriptionLocator.promises.getUsersSubscription = sinon
        .stub()
        .resolves({ recurlySubscription_id: '123' })
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
      this.SubscriptionLocator.promises.getSubscription.resolves(
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
      this.SubscriptionLocator.promises.getSubscription.resolves(
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
      this.SubscriptionLocator.promises.getSubscription.resolves(
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
})
