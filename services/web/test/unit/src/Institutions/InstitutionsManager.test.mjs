const SandboxedModule = require('sandboxed-module')
const path = require('path')
const sinon = require('sinon')
const { expect } = require('chai')
const { ObjectId } = require('mongodb-legacy')
const modulePath = path.join(
  __dirname,
  '../../../../app/src/Features/Institutions/InstitutionsManager'
)
const Features = require('../../../../app/src/infrastructure/Features')

describe('InstitutionsManager', function () {
  beforeEach(function () {
    this.institutionId = 123
    this.user = {}
    const lapsedUser = {
      _id: '657300a08a14461b3d1aac3e',
      features: {},
    }
    this.users = [
      lapsedUser,
      { _id: '657300a08a14461b3d1aac3f', features: {} },
      { _id: '657300a08a14461b3d1aac40', features: {} },
      { _id: '657300a08a14461b3d1aac41', features: {} },
    ]
    this.ssoUsers = [
      {
        _id: '657300a08a14461b3d1aac3f',
        samlIdentifiers: [{ providerId: this.institutionId.toString() }],
      },
      {
        _id: '657300a08a14461b3d1aac40',
        samlIdentifiers: [
          {
            providerId: this.institutionId.toString(),
            hasEntitlement: true,
          },
        ],
      },
      {
        _id: '657300a08a14461b3d1aac3e',
        samlIdentifiers: [{ providerId: this.institutionId.toString() }],
        hasEntitlement: true,
      },
    ]

    this.UserGetter = {
      promises: {
        getUser: sinon.stub().resolves(this.user),
        getUsers: sinon.stub().resolves(this.users),
        getUsersByAnyConfirmedEmail: sinon.stub().resolves(),
        getSsoUsersAtInstitution: (this.getSsoUsersAtInstitution = sinon
          .stub()
          .resolves(this.ssoUsers)),
      },
    }
    this.creator = { create: sinon.stub().resolves() }
    this.NotificationsBuilder = {
      promises: {
        featuresUpgradedByAffiliation: sinon.stub().returns(this.creator),
        redundantPersonalSubscription: sinon.stub().returns(this.creator),
      },
    }
    this.SubscriptionLocator = {
      promises: {
        getUsersSubscription: sinon.stub().resolves(),
      },
    }
    this.institutionWithV1Data = { name: 'Wombat University' }
    this.institution = {
      fetchV1DataPromise: sinon.stub().resolves(this.institutionWithV1Data),
    }
    this.InstitutionModel = {
      Institution: {
        findOne: sinon.stub().returns({
          exec: sinon.stub().resolves(this.institution),
        }),
      },
    }
    this.subscriptionExec = sinon.stub().resolves()
    const SubscriptionModel = {
      Subscription: {
        find: () => ({
          populate: () => ({
            exec: this.subscriptionExec,
          }),
        }),
      },
    }

    this.Mongo = {
      ObjectId,
    }

    this.v1Counts = {
      user_ids: this.users.map(user => user._id),
      current_users_count: 3,
      lapsed_user_ids: [lapsedUser._id],
      entitled_via_sso: 1, // 2 entitled, but 1 lapsed
      with_confirmed_email: 2, // 1 non entitled SSO + 1 email user
    }

    this.InstitutionsManager = SandboxedModule.require(modulePath, {
      requires: {
        './InstitutionsAPI': {
          promises: {
            addAffiliation: (this.addAffiliationPromise = sinon
              .stub()
              .resolves()),
            getInstitutionAffiliations:
              (this.getInstitutionAffiliationsPromise = sinon
                .stub()
                .resolves(this.affiliations)),
            getConfirmedInstitutionAffiliations:
              (this.getConfirmedInstitutionAffiliationsPromise = sinon
                .stub()
                .resolves(this.affiliations)),
            getInstitutionAffiliationsCounts:
              (this.getInstitutionAffiliationsCounts = sinon
                .stub()
                .resolves(this.v1Counts)),
          },
        },
        '../Subscription/FeaturesUpdater': {
          promises: {
            refreshFeatures: (this.refreshFeaturesPromise = sinon
              .stub()
              .resolves()),
          },
        },
        '../Subscription/FeaturesHelper': {
          isFeatureSetBetter: (this.isFeatureSetBetter = sinon.stub()),
        },
        '../User/UserGetter': this.UserGetter,
        '../Notifications/NotificationsBuilder': this.NotificationsBuilder,
        '../Subscription/SubscriptionLocator': this.SubscriptionLocator,
        '../../models/Institution': this.InstitutionModel,
        '../../models/Subscription': SubscriptionModel,
        'mongodb-legacy': this.Mongo,
        '@overleaf/settings': {
          features: { professional: { 'test-feature': true } },
        },
      },
    })
  })

  describe('refreshInstitutionUsers', function () {
    beforeEach(function () {
      this.user1Id = '123abc123abc123abc123abc'
      this.user2Id = '456def456def456def456def'
      this.user3Id = '789abd789abd789abd789abd'
      this.user4Id = '321cba321cba321cba321cba'
      this.affiliations = [
        { user_id: this.user1Id },
        { user_id: this.user2Id },
        { user_id: this.user3Id },
        { user_id: this.user4Id },
      ]
      this.user1 = { _id: this.user1Id }
      this.user2 = { _id: this.user2Id }
      this.user3 = { _id: this.user3Id }
      this.user4 = { _id: this.user4Id }

      this.UserGetter.promises.getUser
        .withArgs(new ObjectId(this.user1Id))
        .resolves(this.user1)
      this.UserGetter.promises.getUser
        .withArgs(new ObjectId(this.user2Id))
        .resolves(this.user2)
      this.UserGetter.promises.getUser
        .withArgs(new ObjectId(this.user3Id))
        .resolves(this.user3)
      this.UserGetter.promises.getUser
        .withArgs(new ObjectId(this.user4Id))
        .resolves(this.user4)

      this.SubscriptionLocator.promises.getUsersSubscription
        .withArgs(this.user2)
        .resolves({
          planCode: 'pro',
          groupPlan: false,
        })
      this.SubscriptionLocator.promises.getUsersSubscription
        .withArgs(this.user3)
        .resolves({
          planCode: 'collaborator_free_trial_7_days',
          groupPlan: false,
        })
      this.SubscriptionLocator.promises.getUsersSubscription
        .withArgs(this.user4)
        .resolves({
          planCode: 'collaborator-annual',
          groupPlan: true,
        })

      this.refreshFeaturesPromise.resolves({
        newFeatures: {},
        featuresChanged: false,
      })
      this.refreshFeaturesPromise
        .withArgs(new ObjectId(this.user1Id))
        .resolves({ newFeatures: {}, featuresChanged: true })
      this.getInstitutionAffiliationsPromise.resolves(this.affiliations)
      this.getConfirmedInstitutionAffiliationsPromise.resolves(
        this.affiliations
      )
    })

    it('refresh all users Features', async function () {
      await this.InstitutionsManager.promises.refreshInstitutionUsers(
        this.institutionId,
        false
      )
      sinon.assert.callCount(this.refreshFeaturesPromise, 4)
      // expect no notifications
      sinon.assert.notCalled(
        this.NotificationsBuilder.promises.featuresUpgradedByAffiliation
      )
      sinon.assert.notCalled(
        this.NotificationsBuilder.promises.redundantPersonalSubscription
      )
    })

    it('notifies users if their features have been upgraded', async function () {
      await this.InstitutionsManager.promises.refreshInstitutionUsers(
        this.institutionId,
        true
      )
      sinon.assert.calledOnce(
        this.NotificationsBuilder.promises.featuresUpgradedByAffiliation
      )
      sinon.assert.calledWith(
        this.NotificationsBuilder.promises.featuresUpgradedByAffiliation,
        this.affiliations[0],
        this.user1
      )
    })

    it('notifies users if they have a subscription, or a trial subscription, that should be cancelled', async function () {
      await this.InstitutionsManager.promises.refreshInstitutionUsers(
        this.institutionId,
        true
      )

      sinon.assert.calledTwice(
        this.NotificationsBuilder.promises.redundantPersonalSubscription
      )
      sinon.assert.calledWith(
        this.NotificationsBuilder.promises.redundantPersonalSubscription,
        this.affiliations[1],
        this.user2
      )
      sinon.assert.calledWith(
        this.NotificationsBuilder.promises.redundantPersonalSubscription,
        this.affiliations[2],
        this.user3
      )
    })
  })

  describe('checkInstitutionUsers', function () {
    it('returns entitled/not, sso/not, lapsed/current, and pro counts', async function () {
      if (Features.hasFeature('saas')) {
        this.isFeatureSetBetter.returns(true)
        const usersSummary =
          await this.InstitutionsManager.promises.checkInstitutionUsers(
            this.institutionId
          )
        expect(usersSummary).to.deep.equal({
          emailUsers: {
            total: 1,
            current: 1,
            lapsed: 0,
            pro: {
              current: 1, // isFeatureSetBetter stubbed to return true for all
              lapsed: 0,
            },
            nonPro: {
              current: 0,
              lapsed: 0,
            },
          },
          ssoUsers: {
            total: 3,
            lapsed: 1,
            current: {
              entitled: 1,
              notEntitled: 1,
            },
            pro: {
              current: 2,
              lapsed: 1, // isFeatureSetBetter stubbed to return true for all users
            },
            nonPro: {
              current: 0,
              lapsed: 0,
            },
          },
        })
      }
    })

    it('includes withConfirmedEmailMismatch when v1 and v2 counts do not add up', async function () {
      if (Features.hasFeature('saas')) {
        this.isFeatureSetBetter.returns(true)
        this.v1Counts.with_confirmed_email = 100
        const usersSummary =
          await this.InstitutionsManager.promises.checkInstitutionUsers(
            this.institutionId
          )
        expect(usersSummary).to.deep.equal({
          emailUsers: {
            total: 1,
            current: 1,
            lapsed: 0,
            pro: {
              current: 1, // isFeatureSetBetter stubbed to return true for all
              lapsed: 0,
            },
            nonPro: {
              current: 0,
              lapsed: 0,
            },
          },
          ssoUsers: {
            total: 3,
            lapsed: 1,
            current: {
              entitled: 1,
              notEntitled: 1,
            },
            pro: {
              current: 2,
              lapsed: 1, // isFeatureSetBetter stubbed to return true for all users
            },
            nonPro: {
              current: 0,
              lapsed: 0,
            },
          },
          databaseMismatch: {
            withConfirmedEmail: {
              v1: 100,
              v2: 2,
            },
          },
        })
      }
    })
  })

  describe('getInstitutionUsersSubscriptions', function () {
    it('returns all institution users subscriptions', async function () {
      const stubbedUsers = [
        { user_id: '123abc123abc123abc123abc' },
        { user_id: '456def456def456def456def' },
        { user_id: '789def789def789def789def' },
      ]
      this.getInstitutionAffiliationsPromise.resolves(stubbedUsers)
      await this.InstitutionsManager.promises.getInstitutionUsersSubscriptions(
        this.institutionId
      )
      sinon.assert.calledOnce(this.subscriptionExec)
    })
  })

  describe('addAffiliations', function () {
    beforeEach(function () {
      this.host = 'mit.edu'.split('').reverse().join('')
      this.stubbedUser1 = {
        _id: '6573014d8a14461b3d1aac3f',
        name: 'bob',
        email: 'hello@world.com',
        emails: [
          { email: 'stubb1@mit.edu', reversedHostname: this.host },
          { email: 'test@test.com', reversedHostname: 'test.com' },
          { email: 'another@mit.edu', reversedHostname: this.host },
        ],
      }
      this.stubbedUser1DecoratedEmails = [
        {
          email: 'stubb1@mit.edu',
          reversedHostname: this.host,
          samlIdentifier: { hasEntitlement: false },
        },
        { email: 'test@test.com', reversedHostname: 'test.com' },
        {
          email: 'another@mit.edu',
          reversedHostname: this.host,
          samlIdentifier: { hasEntitlement: true },
        },
      ]
      this.stubbedUser2 = {
        _id: '6573014d8a14461b3d1aac40',
        name: 'test',
        email: 'hello2@world.com',
        emails: [{ email: 'subb2@mit.edu', reversedHostname: this.host }],
      }
      this.stubbedUser2DecoratedEmails = [
        {
          email: 'subb2@mit.edu',
          reversedHostname: this.host,
        },
      ]

      this.getInstitutionUsersByHostname = sinon.stub().resolves([
        {
          _id: this.stubbedUser1._id,
          emails: this.stubbedUser1DecoratedEmails,
        },
        {
          _id: this.stubbedUser2._id,
          emails: this.stubbedUser2DecoratedEmails,
        },
      ])
      this.UserGetter.promises.getInstitutionUsersByHostname =
        this.getInstitutionUsersByHostname
    })

    describe('affiliateUsers', function () {
      it('should add affiliations for matching users', async function () {
        await this.InstitutionsManager.promises.affiliateUsers('mit.edu')

        this.getInstitutionUsersByHostname.calledOnce.should.equal(true)
        this.addAffiliationPromise.calledThrice.should.equal(true)
        this.addAffiliationPromise
          .calledWithMatch(
            this.stubbedUser1._id,
            this.stubbedUser1.emails[0].email,
            { entitlement: false }
          )
          .should.equal(true)
        this.addAffiliationPromise
          .calledWithMatch(
            this.stubbedUser1._id,
            this.stubbedUser1.emails[2].email,
            { entitlement: true }
          )
          .should.equal(true)
        this.addAffiliationPromise
          .calledWithMatch(
            this.stubbedUser2._id,
            this.stubbedUser2.emails[0].email,
            { entitlement: undefined }
          )
          .should.equal(true)
        this.refreshFeaturesPromise
          .calledWith(this.stubbedUser1._id)
          .should.equal(true)
        this.refreshFeaturesPromise
          .calledWith(this.stubbedUser2._id)
          .should.equal(true)
        this.refreshFeaturesPromise.should.have.been.calledTwice
      })

      it('should return errors if last affiliation cannot be added', async function () {
        this.addAffiliationPromise.onCall(2).rejects()
        await expect(
          this.InstitutionsManager.promises.affiliateUsers('mit.edu')
        ).to.be.rejected

        this.getInstitutionUsersByHostname.calledOnce.should.equal(true)
      })
    })
  })
})
