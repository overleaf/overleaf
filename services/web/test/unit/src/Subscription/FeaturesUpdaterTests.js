const SandboxedModule = require('sandboxed-module')
const { expect } = require('chai')
const sinon = require('sinon')
const { ObjectId } = require('mongodb-legacy')

const MODULE_PATH = '../../../../app/src/Features/Subscription/FeaturesUpdater'

describe('FeaturesUpdater', function () {
  beforeEach(function () {
    this.v1UserId = 12345
    this.user = {
      _id: new ObjectId(),
      features: {},
      overleaf: { id: this.v1UserId },
    }
    this.subscriptions = {
      individual: { planCode: 'individual-plan' },
      group1: { planCode: 'group-plan-1' },
      group2: { planCode: 'group-plan-2' },
      noDropbox: { planCode: 'no-dropbox' },
    }

    this.UserFeaturesUpdater = {
      promises: {
        updateFeatures: sinon
          .stub()
          .resolves({ features: { some: 'features' }, featuresChanged: true }),
      },
    }

    this.SubscriptionLocator = {
      promises: {
        getUserIndividualSubscription: sinon.stub(),
        getGroupSubscriptionsMemberOf: sinon.stub(),
      },
    }
    this.SubscriptionLocator.promises.getUserIndividualSubscription
      .withArgs(this.user._id)
      .resolves(this.subscriptions.individual)
    this.SubscriptionLocator.promises.getGroupSubscriptionsMemberOf
      .withArgs(this.user._id)
      .resolves([this.subscriptions.group1, this.subscriptions.group2])

    this.Settings = {
      defaultFeatures: { default: 'features' },
      plans: [
        { planCode: 'individual-plan', features: { individual: 'features' } },
        { planCode: 'group-plan-1', features: { group1: 'features' } },
        { planCode: 'group-plan-2', features: { group2: 'features' } },
        { planCode: 'no-dropbox', features: { dropbox: false } },
      ],
      features: {
        all: {
          default: 'features',
          individual: 'features',
          group1: 'features',
          group2: 'features',
          institutions: 'features',
          grandfathered: 'features',
          bonus: 'features',
        },
      },
    }

    this.ReferalFeatures = {
      promises: {
        getBonusFeatures: sinon.stub().resolves({ bonus: 'features' }),
      },
    }
    this.V1SubscriptionManager = {
      getGrandfatheredFeaturesForV1User: sinon.stub(),
    }
    this.V1SubscriptionManager.getGrandfatheredFeaturesForV1User
      .withArgs(this.v1UserId)
      .returns({ grandfathered: 'features' })

    this.InstitutionsFeatures = {
      promises: {
        getInstitutionsFeatures: sinon
          .stub()
          .resolves({ institutions: 'features' }),
      },
    }

    this.UserGetter = {
      promises: {
        getUser: sinon.stub().resolves(null),
      },
    }
    this.UserGetter.promises.getUser.withArgs(this.user._id).resolves(this.user)
    this.UserGetter.promises.getUser
      .withArgs({ 'overleaf.id': this.v1UserId })
      .resolves(this.user)

    this.AnalyticsManager = {
      setUserPropertyForUserInBackground: sinon.stub(),
    }
    this.Modules = {
      promises: { hooks: { fire: sinon.stub().resolves() } },
    }

    this.FeaturesUpdater = SandboxedModule.require(MODULE_PATH, {
      requires: {
        './UserFeaturesUpdater': this.UserFeaturesUpdater,
        './SubscriptionLocator': this.SubscriptionLocator,
        '@overleaf/settings': this.Settings,
        '../Referal/ReferalFeatures': this.ReferalFeatures,
        './V1SubscriptionManager': this.V1SubscriptionManager,
        '../Institutions/InstitutionsFeatures': this.InstitutionsFeatures,
        '../User/UserGetter': this.UserGetter,
        '../Analytics/AnalyticsManager': this.AnalyticsManager,
        '../../infrastructure/Modules': this.Modules,
      },
    })
  })

  describe('refreshFeatures', function () {
    it('should return features and featuresChanged', async function () {
      const { features, featuresChanged } =
        await this.FeaturesUpdater.promises.refreshFeatures(
          this.user._id,
          'test'
        )
      expect(features).to.exist
      expect(featuresChanged).to.exist
    })

    describe('normally', function () {
      beforeEach(async function () {
        await this.FeaturesUpdater.promises.refreshFeatures(
          this.user._id,
          'test'
        )
      })

      it('should update the user with the merged features', function () {
        expect(
          this.UserFeaturesUpdater.promises.updateFeatures
        ).to.have.been.calledWith(this.user._id, this.Settings.features.all)
      })

      it('should send the corresponding feature set user property', function () {
        expect(
          this.AnalyticsManager.setUserPropertyForUserInBackground
        ).to.have.been.calledWith(this.user._id, 'feature-set', 'all')
      })
    })

    describe('with a non-standard feature set', async function () {
      beforeEach(async function () {
        this.SubscriptionLocator.promises.getGroupSubscriptionsMemberOf
          .withArgs(this.user._id)
          .resolves(null)
        await this.FeaturesUpdater.promises.refreshFeatures(
          this.user._id,
          'test'
        )
      })

      it('should send mixed feature set user property', function () {
        sinon.assert.calledWith(
          this.AnalyticsManager.setUserPropertyForUserInBackground,
          this.user._id,
          'feature-set',
          'mixed'
        )
      })
    })

    describe('when losing dropbox feature', async function () {
      beforeEach(async function () {
        this.user.features = { dropbox: true }
        this.SubscriptionLocator.promises.getUserIndividualSubscription
          .withArgs(this.user._id)
          .resolves(this.subscriptions.noDropbox)
        await this.FeaturesUpdater.promises.refreshFeatures(
          this.user._id,
          'test'
        )
      })

      it('should fire module hook to unlink dropbox', function () {
        expect(this.Modules.promises.hooks.fire).to.have.been.calledWith(
          'removeDropbox',
          this.user._id,
          'test'
        )
      })
    })
  })

  describe('doSyncFromV1', function () {
    describe('when all goes well', function () {
      beforeEach(async function () {
        await this.FeaturesUpdater.promises.doSyncFromV1(this.v1UserId)
      })

      it('should update the user with the merged features', function () {
        expect(
          this.UserFeaturesUpdater.promises.updateFeatures
        ).to.have.been.calledWith(this.user._id, this.Settings.features.all)
      })
    })

    describe('when getUser produces an error', function () {
      beforeEach(function () {
        this.UserGetter.promises.getUser.rejects(new Error('woops'))
      })

      it('should propagate the error', async function () {
        const someId = 9090
        await expect(this.FeaturesUpdater.promises.doSyncFromV1(someId)).to.be
          .rejected
        expect(this.UserFeaturesUpdater.promises.updateFeatures).not.to.have
          .been.called
      })
    })

    describe('when getUser does not find a user', function () {
      beforeEach(async function () {
        const someOtherId = 987
        await this.FeaturesUpdater.promises.doSyncFromV1(someOtherId)
      })

      it('should not update the user', function () {
        expect(this.UserFeaturesUpdater.promises.updateFeatures).not.to.have
          .been.called
      })
    })
  })
})
