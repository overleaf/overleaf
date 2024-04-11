const SandboxedModule = require('sandboxed-module')
const sinon = require('sinon')
const { assert } = require('chai')
const modulePath =
  '../../../../app/src/Features/Subscription/SubscriptionViewModelBuilder'

describe('SubscriptionViewModelBuilder', function () {
  beforeEach(function () {
    this.user = { _id: '5208dd34438842e2db333333' }
    this.recurlySubscription_id = '123abc456def'
    this.planCode = 'collaborator_monthly'
    this.planFeatures = {
      compileGroup: 'priority',
      collaborators: -1,
      compileTimeout: 240,
    }
    this.plan = {
      planCode: this.planCode,
      features: this.planFeatures,
    }
    this.individualSubscription = {
      planCode: this.planCode,
      plan: this.plan,
      recurlySubscription_id: this.recurlySubscription_id,
      recurlyStatus: {
        state: 'active',
      },
    }

    this.individualCustomSubscription = {
      planCode: this.planCode,
      plan: this.plan,
      recurlySubscription_id: this.recurlySubscription_id,
    }

    this.groupPlanCode = 'group_collaborator_monthly'
    this.groupPlanFeatures = {
      compileGroup: 'priority',
      collaborators: 10,
      compileTimeout: 240,
    }
    this.groupPlan = {
      planCode: this.groupPlanCode,
      features: this.groupPlanFeatures,
    }
    this.groupSubscription = {
      planCode: this.groupPlanCode,
      plan: this.plan,
      recurlyStatus: {
        state: 'active',
      },
    }

    this.commonsPlanCode = 'commons_license'
    this.commonsPlanFeatures = {
      compileGroup: 'priority',
      collaborators: '-1',
      compileTimeout: 240,
    }
    this.commonsPlan = {
      planCode: this.commonsPlanCode,
      features: this.commonsPlanFeatures,
    }
    this.commonsSubscription = {
      planCode: this.commonsPlanCode,
      plan: this.commonsPlan,
      name: 'Digital Science',
    }

    this.Settings = {
      institutionPlanCode: this.commonsPlanCode,
    }
    this.SubscriptionLocator = {
      promises: {
        getUsersSubscription: sinon.stub().resolves(),
        getMemberSubscriptions: sinon.stub().resolves(),
      },
      findLocalPlanInSettings: sinon.stub(),
    }
    this.InstitutionsGetter = {
      promises: {
        getCurrentInstitutionsWithLicence: sinon.stub().resolves(),
      },
    }
    this.InstitutionsManager = {
      promises: {
        fetchV1Data: sinon.stub().resolves(),
      },
    }
    this.RecurlyWrapper = {
      promises: {
        getSubscription: sinon.stub().resolves(),
      },
    }
    this.SubscriptionUpdater = {
      promises: {
        updateSubscriptionFromRecurly: sinon.stub().resolves(),
      },
    }
    this.PlansLocator = {
      findLocalPlanInSettings: sinon.stub(),
    }
    this.SubscriptionViewModelBuilder = SandboxedModule.require(modulePath, {
      requires: {
        '@overleaf/settings': this.Settings,
        './SubscriptionLocator': this.SubscriptionLocator,
        '../Institutions/InstitutionsGetter': this.InstitutionsGetter,
        '../Institutions/InstitutionsManager': this.InstitutionsManager,
        './RecurlyWrapper': this.RecurlyWrapper,
        './SubscriptionUpdater': this.SubscriptionUpdater,
        './PlansLocator': this.PlansLocator,
        './V1SubscriptionManager': {},
        './SubscriptionFormatters': {},
        '../Publishers/PublishersGetter': {},
        './SubscriptionHelper': {},
      },
    })

    this.PlansLocator.findLocalPlanInSettings
      .withArgs(this.planCode)
      .returns(this.plan)
      .withArgs(this.groupPlanCode)
      .returns(this.groupPlan)
      .withArgs(this.commonsPlanCode)
      .returns(this.commonsPlan)
  })

  describe('getBestSubscription', function () {
    it('should return a free plan when user has no subscription or affiliation', async function () {
      const usersBestSubscription =
        await this.SubscriptionViewModelBuilder.promises.getBestSubscription(
          this.user
        )
      assert.deepEqual(usersBestSubscription, { type: 'free' })
    })

    describe('with a individual subscription only', function () {
      it('should return a individual subscription when user has non-Recurly one', async function () {
        this.SubscriptionLocator.promises.getUsersSubscription
          .withArgs(this.user)
          .resolves(this.individualCustomSubscription)

        const usersBestSubscription =
          await this.SubscriptionViewModelBuilder.promises.getBestSubscription(
            this.user
          )

        assert.deepEqual(usersBestSubscription, {
          type: 'individual',
          subscription: this.individualCustomSubscription,
          plan: this.plan,
          remainingTrialDays: -1,
        })
      })

      it('should return a individual subscription when user has an active one', async function () {
        this.SubscriptionLocator.promises.getUsersSubscription
          .withArgs(this.user)
          .resolves(this.individualSubscription)

        const usersBestSubscription =
          await this.SubscriptionViewModelBuilder.promises.getBestSubscription(
            this.user
          )

        assert.deepEqual(usersBestSubscription, {
          type: 'individual',
          subscription: this.individualSubscription,
          plan: this.plan,
          remainingTrialDays: -1,
        })
      })

      it('should return a individual subscription with remaining free trial days', async function () {
        const threeDaysLater = new Date()
        threeDaysLater.setDate(threeDaysLater.getDate() + 3)
        this.individualSubscription.recurlyStatus.trialEndsAt = threeDaysLater
        this.SubscriptionLocator.promises.getUsersSubscription
          .withArgs(this.user)
          .resolves(this.individualSubscription)

        const usersBestSubscription =
          await this.SubscriptionViewModelBuilder.promises.getBestSubscription(
            this.user
          )

        assert.deepEqual(usersBestSubscription, {
          type: 'individual',
          subscription: this.individualSubscription,
          plan: this.plan,
          remainingTrialDays: 3,
        })
      })

      it('should return a individual subscription with free trial on last day', async function () {
        const threeHoursLater = new Date()
        threeHoursLater.setTime(threeHoursLater.getTime() + 3 * 60 * 60 * 1000)
        this.individualSubscription.recurlyStatus.trialEndsAt = threeHoursLater
        this.SubscriptionLocator.promises.getUsersSubscription
          .withArgs(this.user)
          .resolves(this.individualSubscription)

        const usersBestSubscription =
          await this.SubscriptionViewModelBuilder.promises.getBestSubscription(
            this.user
          )

        assert.deepEqual(usersBestSubscription, {
          type: 'individual',
          subscription: this.individualSubscription,
          plan: this.plan,
          remainingTrialDays: 1,
        })
      })

      it('should update subscription if recurly data is missing', async function () {
        this.individualSubscriptionWithoutRecurly = {
          planCode: this.planCode,
          plan: this.plan,
          recurlySubscription_id: this.recurlySubscription_id,
        }
        this.recurlySubscription = {
          state: 'active',
        }
        this.SubscriptionLocator.promises.getUsersSubscription
          .withArgs(this.user)
          .onCall(0)
          .resolves(this.individualSubscriptionWithoutRecurly)
          .withArgs(this.user)
          .onCall(1)
          .resolves(this.individualSubscription)
        this.RecurlyWrapper.promises.getSubscription
          .withArgs(this.individualSubscription.recurlySubscription_id, {
            includeAccount: true,
          })
          .resolves(this.recurlySubscription)

        const usersBestSubscription =
          await this.SubscriptionViewModelBuilder.promises.getBestSubscription(
            this.user
          )

        sinon.assert.calledWith(
          this.RecurlyWrapper.promises.getSubscription,
          this.individualSubscriptionWithoutRecurly.recurlySubscription_id,
          { includeAccount: true }
        )
        sinon.assert.calledWith(
          this.SubscriptionUpdater.promises.updateSubscriptionFromRecurly,
          this.recurlySubscription,
          this.individualSubscriptionWithoutRecurly
        )
        assert.deepEqual(usersBestSubscription, {
          type: 'individual',
          subscription: this.individualSubscription,
          plan: this.plan,
          remainingTrialDays: -1,
        })
      })
    })

    it('should return a group subscription when user has one', async function () {
      this.SubscriptionLocator.promises.getMemberSubscriptions
        .withArgs(this.user)
        .resolves([this.groupSubscription])
      const usersBestSubscription =
        await this.SubscriptionViewModelBuilder.promises.getBestSubscription(
          this.user
        )
      assert.deepEqual(usersBestSubscription, {
        type: 'group',
        subscription: {},
        plan: this.groupPlan,
        remainingTrialDays: -1,
      })
    })

    it('should return a group subscription with team name when user has one', async function () {
      this.SubscriptionLocator.promises.getMemberSubscriptions
        .withArgs(this.user)
        .resolves([
          Object.assign({}, this.groupSubscription, { teamName: 'test team' }),
        ])
      const usersBestSubscription =
        await this.SubscriptionViewModelBuilder.promises.getBestSubscription(
          this.user
        )
      assert.deepEqual(usersBestSubscription, {
        type: 'group',
        subscription: { teamName: 'test team' },
        plan: this.groupPlan,
        remainingTrialDays: -1,
      })
    })

    it('should return a commons subscription when user has an institution affiliation', async function () {
      this.InstitutionsGetter.promises.getCurrentInstitutionsWithLicence
        .withArgs(this.user._id)
        .resolves([this.commonsSubscription])

      const usersBestSubscription =
        await this.SubscriptionViewModelBuilder.promises.getBestSubscription(
          this.user
        )

      assert.deepEqual(usersBestSubscription, {
        type: 'commons',
        subscription: this.commonsSubscription,
        plan: this.commonsPlan,
      })
    })
  })

  describe('with multiple subscriptions', function () {
    beforeEach(function () {
      this.SubscriptionLocator.promises.getUsersSubscription
        .withArgs(this.user)
        .resolves(this.individualSubscription)
      this.SubscriptionLocator.promises.getMemberSubscriptions
        .withArgs(this.user)
        .resolves([this.groupSubscription])
      this.InstitutionsGetter.promises.getCurrentInstitutionsWithLicence
        .withArgs(this.user._id)
        .resolves([this.commonsSubscription])
    })

    it('should return individual when the individual subscription has the best feature set', async function () {
      this.commonsPlan.features = {
        compileGroup: 'standard',
        collaborators: 1,
        compileTimeout: 60,
      }

      const usersBestSubscription =
        await this.SubscriptionViewModelBuilder.promises.getBestSubscription(
          this.user
        )

      assert.deepEqual(usersBestSubscription, {
        type: 'individual',
        subscription: this.individualSubscription,
        plan: this.plan,
        remainingTrialDays: -1,
      })
    })

    it('should return group when the group subscription has the best feature set', async function () {
      this.plan.features = {
        compileGroup: 'standard',
        collaborators: 1,
        compileTimeout: 60,
      }
      this.commonsPlan.features = {
        compileGroup: 'standard',
        collaborators: 1,
        compileTimeout: 60,
      }

      const usersBestSubscription =
        await this.SubscriptionViewModelBuilder.promises.getBestSubscription(
          this.user
        )

      assert.deepEqual(usersBestSubscription, {
        type: 'group',
        subscription: {},
        plan: this.groupPlan,
        remainingTrialDays: -1,
      })
    })

    it('should return commons when the commons affiliation has the best feature set', async function () {
      this.plan.features = {
        compileGroup: 'priority',
        collaborators: 5,
        compileTimeout: 240,
      }
      this.groupPlan.features = {
        compileGroup: 'standard',
        collaborators: 1,
        compileTimeout: 60,
      }
      this.commonsPlan.features = {
        compileGroup: 'priority',
        collaborators: -1,
        compileTimeout: 240,
      }

      const usersBestSubscription =
        await this.SubscriptionViewModelBuilder.promises.getBestSubscription(
          this.user
        )

      assert.deepEqual(usersBestSubscription, {
        type: 'commons',
        subscription: this.commonsSubscription,
        plan: this.commonsPlan,
      })
    })

    it('should return individual with equal feature sets', async function () {
      this.plan.features = {
        compileGroup: 'priority',
        collaborators: -1,
        compileTimeout: 240,
      }
      this.groupPlan.features = {
        compileGroup: 'priority',
        collaborators: -1,
        compileTimeout: 240,
      }
      this.commonsPlan.features = {
        compileGroup: 'priority',
        collaborators: -1,
        compileTimeout: 240,
      }

      const usersBestSubscription =
        await this.SubscriptionViewModelBuilder.promises.getBestSubscription(
          this.user
        )

      assert.deepEqual(usersBestSubscription, {
        type: 'individual',
        subscription: this.individualSubscription,
        plan: this.plan,
        remainingTrialDays: -1,
      })
    })

    it('should return group over commons with equal feature sets', async function () {
      this.plan.features = {
        compileGroup: 'standard',
        collaborators: 1,
        compileTimeout: 60,
      }
      this.groupPlan.features = {
        compileGroup: 'priority',
        collaborators: -1,
        compileTimeout: 240,
      }
      this.commonsPlan.features = {
        compileGroup: 'priority',
        collaborators: -1,
        compileTimeout: 240,
      }

      const usersBestSubscription =
        await this.SubscriptionViewModelBuilder.promises.getBestSubscription(
          this.user
        )

      assert.deepEqual(usersBestSubscription, {
        type: 'group',
        subscription: {},
        plan: this.groupPlan,
        remainingTrialDays: -1,
      })
    })
  })
})
