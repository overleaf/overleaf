import { vi, expect } from 'vitest'
import path from 'node:path'
import sinon from 'sinon'
import mongodb from 'mongodb-legacy'
import Features from '../../../../app/src/infrastructure/Features.mjs'
const modulePath = path.join(
  import.meta.dirname,
  '../../../../app/src/Features/Institutions/InstitutionsManager'
)

const { ObjectId } = mongodb

describe('InstitutionsManager', function () {
  beforeEach(async function (ctx) {
    ctx.institutionId = 123
    ctx.user = {}
    const lapsedUser = {
      _id: '657300a08a14461b3d1aac3e',
      features: {},
    }
    ctx.users = [
      lapsedUser,
      { _id: '657300a08a14461b3d1aac3f', features: {} },
      { _id: '657300a08a14461b3d1aac40', features: {} },
      { _id: '657300a08a14461b3d1aac41', features: {} },
    ]
    ctx.ssoUsers = [
      {
        _id: '657300a08a14461b3d1aac3f',
        samlIdentifiers: [{ providerId: ctx.institutionId.toString() }],
      },
      {
        _id: '657300a08a14461b3d1aac40',
        samlIdentifiers: [
          {
            providerId: ctx.institutionId.toString(),
            hasEntitlement: true,
          },
        ],
      },
      {
        _id: '657300a08a14461b3d1aac3e',
        samlIdentifiers: [{ providerId: ctx.institutionId.toString() }],
        hasEntitlement: true,
      },
    ]

    ctx.UserGetter = {
      promises: {
        getUser: sinon.stub().resolves(ctx.user),
        getUsers: sinon.stub().resolves(ctx.users),
        getUsersByAnyConfirmedEmail: sinon.stub().resolves(),
        getSsoUsersAtInstitution: (ctx.getSsoUsersAtInstitution = sinon
          .stub()
          .resolves(ctx.ssoUsers)),
      },
    }
    ctx.creator = { create: sinon.stub().resolves() }
    ctx.NotificationsBuilder = {
      promises: {
        featuresUpgradedByAffiliation: sinon.stub().returns(ctx.creator),
        redundantPersonalSubscription: sinon.stub().returns(ctx.creator),
      },
    }
    ctx.SubscriptionLocator = {
      promises: {
        getUsersSubscription: sinon.stub().resolves(),
      },
    }
    ctx.institutionWithV1Data = { name: 'Wombat University' }
    ctx.institution = {
      fetchV1DataPromise: sinon.stub().resolves(ctx.institutionWithV1Data),
    }
    ctx.InstitutionModel = {
      Institution: {
        findOne: sinon.stub().returns({
          exec: sinon.stub().resolves(ctx.institution),
        }),
      },
    }
    ctx.subscriptionExec = sinon.stub().resolves()
    const SubscriptionModel = {
      Subscription: {
        find: () => ({
          populate: () => ({
            exec: ctx.subscriptionExec,
          }),
        }),
      },
    }

    ctx.Mongo = {
      ObjectId,
    }

    ctx.v1Counts = {
      user_ids: ctx.users.map(user => user._id),
      current_users_count: 3,
      lapsed_user_ids: [lapsedUser._id],
      entitled_via_sso: 1, // 2 entitled, but 1 lapsed
      with_confirmed_email: 2, // 1 non entitled SSO + 1 email user
    }

    vi.doMock(
      '../../../../app/src/Features/Institutions/InstitutionsAPI',
      () => ({
        default: {
          promises: {
            addAffiliation: (ctx.addAffiliationPromise = sinon
              .stub()
              .resolves()),
            getInstitutionAffiliations: (ctx.getInstitutionAffiliationsPromise =
              sinon.stub().resolves(ctx.affiliations)),
            getConfirmedInstitutionAffiliations:
              (ctx.getConfirmedInstitutionAffiliationsPromise = sinon
                .stub()
                .resolves(ctx.affiliations)),
            getInstitutionAffiliationsCounts:
              (ctx.getInstitutionAffiliationsCounts = sinon
                .stub()
                .resolves(ctx.v1Counts)),
          },
        },
      })
    )

    vi.doMock(
      '../../../../app/src/Features/Subscription/FeaturesUpdater',
      () => ({
        default: {
          promises: {
            refreshFeatures: (ctx.refreshFeaturesPromise = sinon
              .stub()
              .resolves()),
          },
        },
      })
    )

    vi.doMock(
      '../../../../app/src/Features/Subscription/FeaturesHelper',
      () => ({
        default: {
          isFeatureSetBetter: (ctx.isFeatureSetBetter = sinon.stub()),
        },
      })
    )

    vi.doMock('../../../../app/src/Features/User/UserGetter', () => ({
      default: ctx.UserGetter,
    }))

    vi.doMock(
      '../../../../app/src/Features/Notifications/NotificationsBuilder',
      () => ({
        default: ctx.NotificationsBuilder,
      })
    )

    vi.doMock(
      '../../../../app/src/Features/Subscription/SubscriptionLocator',
      () => ({
        default: ctx.SubscriptionLocator,
      })
    )

    vi.doMock(
      '../../../../app/src/models/Institution',
      () => ctx.InstitutionModel
    )

    vi.doMock(
      '../../../../app/src/models/Subscription',
      () => SubscriptionModel
    )

    vi.doMock('mongodb-legacy', () => ({
      default: ctx.Mongo,
    }))

    vi.doMock('@overleaf/settings', () => ({
      default: {
        features: { professional: { 'test-feature': true } },
      },
    }))

    ctx.InstitutionsManager = (await import(modulePath)).default
  })

  describe('refreshInstitutionUsers', function () {
    beforeEach(function (ctx) {
      ctx.user1Id = '123abc123abc123abc123abc'
      ctx.user2Id = '456def456def456def456def'
      ctx.user3Id = '789abd789abd789abd789abd'
      ctx.user4Id = '321cba321cba321cba321cba'
      ctx.affiliations = [
        { user_id: ctx.user1Id },
        { user_id: ctx.user2Id },
        { user_id: ctx.user3Id },
        { user_id: ctx.user4Id },
      ]
      ctx.user1 = { _id: ctx.user1Id }
      ctx.user2 = { _id: ctx.user2Id }
      ctx.user3 = { _id: ctx.user3Id }
      ctx.user4 = { _id: ctx.user4Id }

      ctx.UserGetter.promises.getUser
        .withArgs(new ObjectId(ctx.user1Id))
        .resolves(ctx.user1)
      ctx.UserGetter.promises.getUser
        .withArgs(new ObjectId(ctx.user2Id))
        .resolves(ctx.user2)
      ctx.UserGetter.promises.getUser
        .withArgs(new ObjectId(ctx.user3Id))
        .resolves(ctx.user3)
      ctx.UserGetter.promises.getUser
        .withArgs(new ObjectId(ctx.user4Id))
        .resolves(ctx.user4)

      ctx.SubscriptionLocator.promises.getUsersSubscription
        .withArgs(ctx.user2)
        .resolves({
          planCode: 'pro',
          groupPlan: false,
        })
      ctx.SubscriptionLocator.promises.getUsersSubscription
        .withArgs(ctx.user3)
        .resolves({
          planCode: 'collaborator_free_trial_7_days',
          groupPlan: false,
        })
      ctx.SubscriptionLocator.promises.getUsersSubscription
        .withArgs(ctx.user4)
        .resolves({
          planCode: 'collaborator-annual',
          groupPlan: true,
        })

      ctx.refreshFeaturesPromise.resolves({
        newFeatures: {},
        featuresChanged: false,
      })
      ctx.refreshFeaturesPromise
        .withArgs(new ObjectId(ctx.user1Id))
        .resolves({ newFeatures: {}, featuresChanged: true })
      ctx.getInstitutionAffiliationsPromise.resolves(ctx.affiliations)
      ctx.getConfirmedInstitutionAffiliationsPromise.resolves(ctx.affiliations)
    })

    it('refresh all users Features', async function (ctx) {
      await ctx.InstitutionsManager.promises.refreshInstitutionUsers(
        ctx.institutionId,
        false
      )
      sinon.assert.callCount(ctx.refreshFeaturesPromise, 4)
      // expect no notifications
      sinon.assert.notCalled(
        ctx.NotificationsBuilder.promises.featuresUpgradedByAffiliation
      )
      sinon.assert.notCalled(
        ctx.NotificationsBuilder.promises.redundantPersonalSubscription
      )
    })

    it('notifies users if their features have been upgraded', async function (ctx) {
      await ctx.InstitutionsManager.promises.refreshInstitutionUsers(
        ctx.institutionId,
        true
      )
      sinon.assert.calledOnce(
        ctx.NotificationsBuilder.promises.featuresUpgradedByAffiliation
      )
      sinon.assert.calledWith(
        ctx.NotificationsBuilder.promises.featuresUpgradedByAffiliation,
        ctx.affiliations[0],
        ctx.user1
      )
    })

    it('notifies users if they have a subscription, or a trial subscription, that should be cancelled', async function (ctx) {
      await ctx.InstitutionsManager.promises.refreshInstitutionUsers(
        ctx.institutionId,
        true
      )

      sinon.assert.calledTwice(
        ctx.NotificationsBuilder.promises.redundantPersonalSubscription
      )
      sinon.assert.calledWith(
        ctx.NotificationsBuilder.promises.redundantPersonalSubscription,
        ctx.affiliations[1],
        ctx.user2
      )
      sinon.assert.calledWith(
        ctx.NotificationsBuilder.promises.redundantPersonalSubscription,
        ctx.affiliations[2],
        ctx.user3
      )
    })
  })

  describe('checkInstitutionUsers', function () {
    it('returns entitled/not, sso/not, lapsed/current, and pro counts', async function (ctx) {
      if (Features.hasFeature('saas')) {
        ctx.isFeatureSetBetter.returns(true)
        const usersSummary =
          await ctx.InstitutionsManager.promises.checkInstitutionUsers(
            ctx.institutionId
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

    it('includes withConfirmedEmailMismatch when v1 and v2 counts do not add up', async function (ctx) {
      if (Features.hasFeature('saas')) {
        ctx.isFeatureSetBetter.returns(true)
        ctx.v1Counts.with_confirmed_email = 100
        const usersSummary =
          await ctx.InstitutionsManager.promises.checkInstitutionUsers(
            ctx.institutionId
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
    it('returns all institution users subscriptions', async function (ctx) {
      const stubbedUsers = [
        { user_id: '123abc123abc123abc123abc' },
        { user_id: '456def456def456def456def' },
        { user_id: '789def789def789def789def' },
      ]
      ctx.getInstitutionAffiliationsPromise.resolves(stubbedUsers)
      await ctx.InstitutionsManager.promises.getInstitutionUsersSubscriptions(
        ctx.institutionId
      )
      sinon.assert.calledOnce(ctx.subscriptionExec)
    })
  })

  describe('addAffiliations', function () {
    beforeEach(function (ctx) {
      ctx.host = 'mit.edu'.split('').reverse().join('')
      ctx.stubbedUser1 = {
        _id: '6573014d8a14461b3d1aac3f',
        name: 'bob',
        email: 'hello@world.com',
        emails: [
          { email: 'stubb1@mit.edu', reversedHostname: ctx.host },
          { email: 'test@test.com', reversedHostname: 'test.com' },
          { email: 'another@mit.edu', reversedHostname: ctx.host },
        ],
      }
      ctx.stubbedUser1DecoratedEmails = [
        {
          email: 'stubb1@mit.edu',
          reversedHostname: ctx.host,
          samlIdentifier: { hasEntitlement: false },
        },
        { email: 'test@test.com', reversedHostname: 'test.com' },
        {
          email: 'another@mit.edu',
          reversedHostname: ctx.host,
          samlIdentifier: { hasEntitlement: true },
        },
      ]
      ctx.stubbedUser2 = {
        _id: '6573014d8a14461b3d1aac40',
        name: 'test',
        email: 'hello2@world.com',
        emails: [{ email: 'subb2@mit.edu', reversedHostname: ctx.host }],
      }
      ctx.stubbedUser2DecoratedEmails = [
        {
          email: 'subb2@mit.edu',
          reversedHostname: ctx.host,
        },
      ]

      ctx.getInstitutionUsersByHostname = sinon.stub().resolves([
        {
          _id: ctx.stubbedUser1._id,
          emails: ctx.stubbedUser1DecoratedEmails,
        },
        {
          _id: ctx.stubbedUser2._id,
          emails: ctx.stubbedUser2DecoratedEmails,
        },
      ])
      ctx.UserGetter.promises.getInstitutionUsersByHostname =
        ctx.getInstitutionUsersByHostname
    })

    describe('affiliateUsers', function () {
      it('should add affiliations for matching users', async function (ctx) {
        await ctx.InstitutionsManager.promises.affiliateUsers('mit.edu')

        ctx.getInstitutionUsersByHostname.calledOnce.should.equal(true)
        ctx.addAffiliationPromise.calledThrice.should.equal(true)
        ctx.addAffiliationPromise
          .calledWithMatch(
            ctx.stubbedUser1._id,
            ctx.stubbedUser1.emails[0].email,
            { entitlement: false }
          )
          .should.equal(true)
        ctx.addAffiliationPromise
          .calledWithMatch(
            ctx.stubbedUser1._id,
            ctx.stubbedUser1.emails[2].email,
            { entitlement: true }
          )
          .should.equal(true)
        ctx.addAffiliationPromise
          .calledWithMatch(
            ctx.stubbedUser2._id,
            ctx.stubbedUser2.emails[0].email,
            { entitlement: undefined }
          )
          .should.equal(true)
        ctx.refreshFeaturesPromise
          .calledWith(ctx.stubbedUser1._id)
          .should.equal(true)
        ctx.refreshFeaturesPromise
          .calledWith(ctx.stubbedUser2._id)
          .should.equal(true)
        ctx.refreshFeaturesPromise.should.have.been.calledTwice
      })

      it('should return errors if last affiliation cannot be added', async function (ctx) {
        ctx.addAffiliationPromise.onCall(2).rejects()
        await expect(ctx.InstitutionsManager.promises.affiliateUsers('mit.edu'))
          .to.be.rejected

        ctx.getInstitutionUsersByHostname.calledOnce.should.equal(true)
      })
    })
  })
})
