const SandboxedModule = require('sandboxed-module')
const path = require('path')
const sinon = require('sinon')
const { expect } = require('chai')
const modulePath = path.join(
  __dirname,
  '../../../../app/src/Features/Institutions/InstitutionsManager'
)
const Features = require('../../../../app/src/infrastructure/Features')

describe('InstitutionsManager', function () {
  beforeEach(function () {
    this.institutionId = 123
    this.user = {}
    this.getInstitutionAffiliations = sinon.stub()
    this.getConfirmedInstitutionAffiliations = sinon.stub()
    this.addAffiliation = sinon.stub().callsArgWith(3, null)
    this.refreshFeatures = sinon.stub().yields()
    this.users = [
      { _id: 'lapsed', features: {} },
      { _id: '1a', features: {} },
      { _id: '2b', features: {} },
      { _id: '3c', features: {} },
    ]
    this.ssoUsers = [
      {
        _id: '1a',
        samlIdentifiers: [{ providerId: this.institutionId.toString() }],
      },
      {
        _id: '2b',
        samlIdentifiers: [
          {
            providerId: this.institutionId.toString(),
            hasEntitlement: true,
          },
        ],
      },
      {
        _id: 'lapsed',
        samlIdentifiers: [{ providerId: this.institutionId.toString() }],
        hasEntitlement: true,
      },
    ]

    this.UserGetter = {
      getUsersByAnyConfirmedEmail: sinon.stub().yields(),
      getUser: sinon.stub().yields(null, this.user),
      promises: {
        getUsers: sinon.stub().resolves(this.users),
        getUsersByAnyConfirmedEmail: sinon.stub().resolves(),
        getSsoUsersAtInstitution: (this.getSsoUsersAtInstitution = sinon
          .stub()
          .resolves(this.ssoUsers)),
      },
    }
    this.creator = { create: sinon.stub().callsArg(0) }
    this.NotificationsBuilder = {
      featuresUpgradedByAffiliation: sinon.stub().returns(this.creator),
      redundantPersonalSubscription: sinon.stub().returns(this.creator),
    }
    this.SubscriptionLocator = {
      getUsersSubscription: sinon.stub().callsArg(1),
    }
    this.institutionWithV1Data = { name: 'Wombat University' }
    this.institution = {
      fetchV1Data: sinon
        .stub()
        .callsArgWith(0, null, this.institutionWithV1Data),
    }
    this.InstitutionModel = {
      Institution: {
        findOne: sinon.stub().callsArgWith(1, null, this.institution),
      },
    }
    this.subscriptionExec = sinon.stub().yields()
    const SubscriptionModel = {
      Subscription: {
        find: () => ({
          populate: () => ({
            exec: this.subscriptionExec,
          }),
        }),
      },
    }
    this.Mongo = { ObjectId: sinon.stub().returnsArg(0) }

    this.v1Counts = {
      user_ids: this.users.map(user => user._id),
      current_users_count: 3,
      lapsed_user_ids: ['lapsed'],
      entitled_via_sso: 1, // 2 entitled, but 1 lapsed
      with_confirmed_email: 2, // 1 non entitled SSO + 1 email user
    }

    // this.InstitutionsController = SandboxedModule.require(modulePath, {
    //   requires: {
    //     '../User/UserGetter': {
    //       getInstitutionUsersByHostname: this.getInstitutionUsersByHostname,
    //     },
    //     '../Institutions/InstitutionsAPI': {
    //       addAffiliation: this.addAffiliation,
    //     },
    //     '../Subscription/FeaturesUpdater': {
    //       refreshFeatures: this.refreshFeatures,
    //     },
    //   },

    this.InstitutionsManager = SandboxedModule.require(modulePath, {
      requires: {
        './InstitutionsAPI': {
          getInstitutionAffiliations: this.getInstitutionAffiliations,
          getConfirmedInstitutionAffiliations:
            this.getConfirmedInstitutionAffiliations,
          addAffiliation: this.addAffiliation,
          promises: {
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
          refreshFeatures: this.refreshFeatures,
        },
        '../Subscription/FeaturesHelper': {
          isFeatureSetBetter: (this.isFeatureSetBetter = sinon.stub()),
        },
        '../User/UserGetter': this.UserGetter,
        '../Notifications/NotificationsBuilder': this.NotificationsBuilder,
        '../Subscription/SubscriptionLocator': this.SubscriptionLocator,
        '../../models/Institution': this.InstitutionModel,
        '../../models/Subscription': SubscriptionModel,
        mongodb: this.Mongo,
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
      this.user3Id = 'trial123abc'
      this.user4Id = 'group123abc'
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

      this.UserGetter.getUser.withArgs(this.user1Id).yields(null, this.user1)
      this.UserGetter.getUser.withArgs(this.user2Id).yields(null, this.user2)
      this.UserGetter.getUser.withArgs(this.user3Id).yields(null, this.user3)
      this.UserGetter.getUser.withArgs(this.user4Id).yields(null, this.user4)

      this.SubscriptionLocator.getUsersSubscription
        .withArgs(this.user2)
        .callsArgWith(1, null, {
          planCode: 'pro',
          groupPlan: false,
        })
      this.SubscriptionLocator.getUsersSubscription
        .withArgs(this.user3)
        .callsArgWith(1, null, {
          planCode: 'collaborator_free_trial_7_days',
          groupPlan: false,
        })
      this.SubscriptionLocator.getUsersSubscription
        .withArgs(this.user4)
        .callsArgWith(1, null, {
          planCode: 'collaborator-annual',
          groupPlan: true,
        })

      this.refreshFeatures.withArgs(this.user1Id).yields(null, {}, true)
      this.getInstitutionAffiliations.yields(null, this.affiliations)
      this.getConfirmedInstitutionAffiliations.yields(null, this.affiliations)
    })

    it('refresh all users Features', function (done) {
      this.InstitutionsManager.refreshInstitutionUsers(
        this.institutionId,
        false,
        error => {
          expect(error).not.to.exist
          sinon.assert.callCount(this.refreshFeatures, 4)
          // expect no notifications
          sinon.assert.notCalled(
            this.NotificationsBuilder.featuresUpgradedByAffiliation
          )
          sinon.assert.notCalled(
            this.NotificationsBuilder.redundantPersonalSubscription
          )
          done()
        }
      )
    })

    it('notifies users if their features have been upgraded', function (done) {
      this.InstitutionsManager.refreshInstitutionUsers(
        this.institutionId,
        true,
        error => {
          expect(error).not.to.exist
          sinon.assert.calledOnce(
            this.NotificationsBuilder.featuresUpgradedByAffiliation
          )
          sinon.assert.calledWith(
            this.NotificationsBuilder.featuresUpgradedByAffiliation,
            this.affiliations[0],
            this.user1
          )
          done()
        }
      )
    })

    it('notifies users if they have a subscription, or a trial subscription, that should be cancelled', function (done) {
      this.InstitutionsManager.refreshInstitutionUsers(
        this.institutionId,
        true,
        error => {
          expect(error).not.to.exist
          sinon.assert.calledTwice(
            this.NotificationsBuilder.redundantPersonalSubscription
          )
          sinon.assert.calledWith(
            this.NotificationsBuilder.redundantPersonalSubscription,
            this.affiliations[1],
            this.user2
          )
          sinon.assert.calledWith(
            this.NotificationsBuilder.redundantPersonalSubscription,
            this.affiliations[2],
            this.user3
          )
          done()
        }
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
    it('returns all institution users subscriptions', function (done) {
      const stubbedUsers = [
        { user_id: '123abc123abc123abc123abc' },
        { user_id: '456def456def456def456def' },
        { user_id: '789def789def789def789def' },
      ]
      this.getInstitutionAffiliations.yields(null, stubbedUsers)
      this.InstitutionsManager.getInstitutionUsersSubscriptions(
        this.institutionId,
        (error, subscriptions) => {
          expect(error).not.to.exist
          sinon.assert.calledOnce(this.subscriptionExec)
          done()
        }
      )
    })
  })

  describe('addAffiliations', function () {
    beforeEach(function () {
      this.host = 'mit.edu'.split('').reverse().join('')
      this.stubbedUser1 = {
        _id: '3131231',
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
        _id: '3131232',
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

      this.getInstitutionUsersByHostname = sinon.stub().yields(null, [
        {
          _id: this.stubbedUser1._id,
          emails: this.stubbedUser1DecoratedEmails,
        },
        {
          _id: this.stubbedUser2._id,
          emails: this.stubbedUser2DecoratedEmails,
        },
      ])
      this.UserGetter.getInstitutionUsersByHostname =
        this.getInstitutionUsersByHostname
    })

    describe('affiliateUsers', function () {
      it('should add affiliations for matching users', function (done) {
        this.InstitutionsManager.affiliateUsers('mit.edu', error => {
          expect(error).not.to.exist
          this.getInstitutionUsersByHostname.calledOnce.should.equal(true)
          this.addAffiliation.calledThrice.should.equal(true)
          this.addAffiliation
            .calledWithMatch(
              this.stubbedUser1._id,
              this.stubbedUser1.emails[0].email,
              { entitlement: false }
            )
            .should.equal(true)
          this.addAffiliation
            .calledWithMatch(
              this.stubbedUser1._id,
              this.stubbedUser1.emails[2].email,
              { entitlement: true }
            )
            .should.equal(true)
          this.addAffiliation
            .calledWithMatch(
              this.stubbedUser2._id,
              this.stubbedUser2.emails[0].email,
              { entitlement: undefined }
            )
            .should.equal(true)
          this.refreshFeatures
            .calledWith(this.stubbedUser1._id)
            .should.equal(true)
          this.refreshFeatures
            .calledWith(this.stubbedUser2._id)
            .should.equal(true)
          this.refreshFeatures.should.have.been.calledTwice
          done()
        })
      })

      it('should return errors if last affiliation cannot be added', function (done) {
        this.addAffiliation.onCall(2).callsArgWith(3, new Error('error'))
        this.InstitutionsManager.affiliateUsers('mit.edu', error => {
          expect(error).to.exist
          this.getInstitutionUsersByHostname.calledOnce.should.equal(true)
          done()
        })
      })
    })
  })
})
