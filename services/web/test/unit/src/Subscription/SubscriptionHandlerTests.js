const SandboxedModule = require('sandboxed-module')
const sinon = require('sinon')
const chai = require('chai')
const { expect } = chai

const MODULE_PATH =
  '../../../../app/src/Features/Subscription/SubscriptionHandler'

const mockRecurlySubscriptions = {
  'subscription-123-active': {
    uuid: 'subscription-123-active',
    plan: {
      name: 'Gold',
      plan_code: 'gold',
    },
    current_period_ends_at: new Date(),
    state: 'active',
    unit_amount_in_cents: 999,
    account: {
      account_code: 'user-123',
    },
  },
}

const mockRecurlyClientSubscriptions = {
  'subscription-123-active': {
    id: 'subscription-123-recurly-id',
    uuid: 'subscription-123-active',
    plan: {
      name: 'Gold',
      code: 'gold',
    },
    currentPeriodEndsAt: new Date(),
    state: 'active',
    unitAmount: 10,
    account: {
      code: 'user-123',
    },
  },
}

const mockSubscriptionChanges = {
  'subscription-123-active': {
    id: 'subscription-change-id',
    subscriptionId: 'subscription-123-recurly-id', // not the UUID
  },
}

describe('SubscriptionHandler', function () {
  beforeEach(function () {
    this.Settings = {
      plans: [
        {
          planCode: 'collaborator',
          name: 'Collaborator',
          features: {
            collaborators: -1,
            versioning: true,
          },
        },
      ],
      defaultPlanCode: {
        collaborators: 0,
        versioning: false,
      },
    }
    this.activeRecurlySubscription =
      mockRecurlySubscriptions['subscription-123-active']
    this.activeRecurlyClientSubscription =
      mockRecurlyClientSubscriptions['subscription-123-active']
    this.activeRecurlySubscriptionChange =
      mockSubscriptionChanges['subscription-123-active']
    this.User = {}
    this.user = { _id: (this.user_id = 'user_id_here_') }
    this.subscription = {
      recurlySubscription_id: this.activeRecurlySubscription.uuid,
    }
    this.RecurlyWrapper = {
      promises: {
        getSubscription: sinon.stub().resolves(this.activeRecurlySubscription),
        redeemCoupon: sinon.stub().resolves(),
        createSubscription: sinon
          .stub()
          .resolves(this.activeRecurlySubscription),
        getBillingInfo: sinon.stub().resolves(),
        getAccountPastDueInvoices: sinon.stub().resolves(),
        attemptInvoiceCollection: sinon.stub().resolves(),
        listAccountActiveSubscriptions: sinon.stub().resolves([]),
      },
    }
    this.RecurlyClient = {
      promises: {
        reactivateSubscriptionByUuid: sinon
          .stub()
          .resolves(this.activeRecurlyClientSubscription),
        cancelSubscriptionByUuid: sinon.stub().resolves(),
        changeSubscriptionByUuid: sinon
          .stub()
          .resolves(this.activeRecurlySubscriptionChange),
        getSubscription: sinon
          .stub()
          .resolves(this.activeRecurlyClientSubscription),
      },
    }

    this.SubscriptionUpdater = {
      promises: {
        updateSubscriptionFromRecurly: sinon.stub().resolves(),
        syncSubscription: sinon.stub().resolves(),
        startFreeTrial: sinon.stub().resolves(),
      },
    }

    this.LimitationsManager = {
      promises: {
        userHasV2Subscription: sinon.stub().resolves(),
      },
    }

    this.EmailHandler = {
      sendEmail: sinon.stub(),
      sendDeferredEmail: sinon.stub(),
    }

    this.PlansLocator = {
      findLocalPlanInSettings: sinon.stub().returns({ planCode: 'plan' }),
    }

    this.SubscriptionHelper = {
      shouldPlanChangeAtTermEnd: sinon.stub(),
    }

    this.UserUpdater = {
      promises: {
        updateUser: sinon.stub().resolves(),
      },
    }

    this.SubscriptionHandler = SandboxedModule.require(MODULE_PATH, {
      requires: {
        './RecurlyWrapper': this.RecurlyWrapper,
        './RecurlyClient': this.RecurlyClient,
        '@overleaf/settings': this.Settings,
        '../../models/User': {
          User: this.User,
        },
        './SubscriptionUpdater': this.SubscriptionUpdater,
        './LimitationsManager': this.LimitationsManager,
        '../Email/EmailHandler': this.EmailHandler,
        '../Analytics/AnalyticsManager': this.AnalyticsManager,
        './PlansLocator': this.PlansLocator,
        './SubscriptionHelper': this.SubscriptionHelper,
        '../User/UserUpdater': this.UserUpdater,
      },
    })
  })

  describe('createSubscription', function () {
    beforeEach(function () {
      this.subscriptionDetails = {
        cvv: '123',
        number: '12345',
      }
      this.recurlyTokenIds = { billing: '45555666' }
    })

    describe('successfully', function () {
      beforeEach(async function () {
        await this.SubscriptionHandler.promises.createSubscription(
          this.user,
          this.subscriptionDetails,
          this.recurlyTokenIds
        )
      })

      it('should create the subscription with the wrapper', function () {
        this.RecurlyWrapper.promises.createSubscription
          .calledWith(this.user, this.subscriptionDetails, this.recurlyTokenIds)
          .should.equal(true)
      })

      it('should sync the subscription to the user', function () {
        this.SubscriptionUpdater.promises.syncSubscription.calledOnce.should.equal(
          true
        )
        this.SubscriptionUpdater.promises.syncSubscription.args[0][0].should.deep.equal(
          this.activeRecurlySubscription
        )
        this.SubscriptionUpdater.promises.syncSubscription.args[0][1].should.deep.equal(
          this.user._id
        )
      })

      it('should not set last trial date if not a trial/the trial_started_at is not set', function () {
        this.UserUpdater.promises.updateUser.should.not.have.been.called
      })
    })

    describe('when the subscription is a trial and has a trial_started_at date', function () {
      beforeEach(async function () {
        this.activeRecurlySubscription.trial_started_at =
          '2024-01-01T09:58:35.531+00:00'
        await this.SubscriptionHandler.promises.createSubscription(
          this.user,
          this.subscriptionDetails,
          this.recurlyTokenIds
        )
      })
      it('should set the users lastTrial date', function () {
        this.UserUpdater.promises.updateUser.should.have.been.calledOnce
        expect(this.UserUpdater.promises.updateUser.args[0][0]).to.deep.equal({
          _id: this.user_id,
          lastTrial: {
            $not: {
              $gt: new Date(this.activeRecurlySubscription.trial_started_at),
            },
          },
        })
        expect(this.UserUpdater.promises.updateUser.args[0][1]).to.deep.equal({
          $set: {
            lastTrial: new Date(
              this.activeRecurlySubscription.trial_started_at
            ),
          },
        })
      })
    })

    describe('when there is already a subscription in Recurly', function () {
      beforeEach(function () {
        this.RecurlyWrapper.promises.listAccountActiveSubscriptions.resolves([
          this.subscription,
        ])
      })

      it('should an error', function () {
        expect(
          this.SubscriptionHandler.promises.createSubscription(
            this.user,
            this.subscriptionDetails,
            this.recurlyTokenIds
          )
        ).to.be.rejectedWith('user already has subscription in recurly')
      })
    })
  })

  function shouldUpdateSubscription() {
    it('should update the subscription', function () {
      expect(
        this.RecurlyClient.promises.changeSubscriptionByUuid
      ).to.have.been.calledWith(this.subscription.recurlySubscription_id)
      const updateOptions =
        this.RecurlyClient.promises.changeSubscriptionByUuid.args[0][1]
      updateOptions.planCode.should.equal(this.plan_code)
    })
  }

  function shouldSyncSubscription() {
    it('should sync the new subscription to the user', function () {
      expect(this.SubscriptionUpdater.promises.syncSubscription).to.have.been
        .called

      this.SubscriptionUpdater.promises.syncSubscription.args[0][0].should.deep.equal(
        this.activeRecurlySubscription
      )
      this.SubscriptionUpdater.promises.syncSubscription.args[0][1].should.deep.equal(
        this.user._id
      )
    })
  }

  function testUserWithASubscription(shouldPlanChangeAtTermEnd, timeframe) {
    describe(
      'when change should happen with timeframe ' + timeframe,
      function () {
        beforeEach(async function () {
          this.user.id = this.activeRecurlySubscription.account.account_code
          this.User.findById = (userId, projection) => ({
            exec: () => {
              userId.should.equal(this.user.id)
              return Promise.resolve(this.user)
            },
          })
          this.plan_code = 'collaborator'
          this.SubscriptionHelper.shouldPlanChangeAtTermEnd.returns(
            shouldPlanChangeAtTermEnd
          )
          this.LimitationsManager.promises.userHasV2Subscription.resolves({
            hasSubscription: true,
            subscription: this.subscription,
          })
          await this.SubscriptionHandler.promises.updateSubscription(
            this.user,
            this.plan_code,
            null
          )
        })

        shouldUpdateSubscription()
        shouldSyncSubscription()

        it('should update with timeframe ' + timeframe, function () {
          const updateOptions =
            this.RecurlyClient.promises.changeSubscriptionByUuid.args[0][1]
          updateOptions.timeframe.should.equal(timeframe)
        })
      }
    )
  }

  describe('updateSubscription', function () {
    describe('with a user with a subscription', function () {
      testUserWithASubscription(false, 'now')
      testUserWithASubscription(true, 'term_end')

      describe('when plan(s) could not be located in settings', function () {
        beforeEach(async function () {
          this.user.id = this.activeRecurlySubscription.account.account_code
          this.User.findById = (userId, projection) => ({
            exec: () => {
              userId.should.equal(this.user.id)
              return Promise.resolve(this.user)
            },
          })

          this.plan_code = 'collaborator'
          this.PlansLocator.findLocalPlanInSettings.returns(null)
          this.LimitationsManager.promises.userHasV2Subscription.resolves({
            hasSubscription: true,
            subscription: this.subscription,
          })
        })

        it('should be rejected and should not update the subscription', function () {
          expect(
            this.SubscriptionHandler.promises.updateSubscription(
              this.user,
              this.plan_code,
              null
            )
          ).to.be.rejected
          this.RecurlyClient.promises.changeSubscriptionByUuid.called.should.equal(
            false
          )
        })
      })
    })

    describe('with a user without a subscription', function () {
      beforeEach(async function () {
        this.LimitationsManager.promises.userHasV2Subscription.resolves(false)
        await this.SubscriptionHandler.promises.updateSubscription(
          this.user,
          this.plan_code,
          null
        )
      })

      it('should redirect to the subscription dashboard', function () {
        this.RecurlyClient.promises.changeSubscriptionByUuid.called.should.equal(
          false
        )
        this.SubscriptionUpdater.promises.syncSubscription.called.should.equal(
          false
        )
      })
    })

    describe('with a coupon code', function () {
      beforeEach(async function () {
        this.user.id = this.activeRecurlySubscription.account.account_code

        this.User.findById = (userId, projection) => ({
          exec: () => {
            userId.should.equal(this.user.id)
            return Promise.resolve(this.user)
          },
        })
        this.plan_code = 'collaborator'
        this.coupon_code = '1231312'
        this.LimitationsManager.promises.userHasV2Subscription.resolves({
          hasSubscription: true,
          subscription: this.subscription,
        })
        await this.SubscriptionHandler.promises.updateSubscription(
          this.user,
          this.plan_code,
          this.coupon_code
        )
      })

      it('should get the users account', function () {
        this.RecurlyWrapper.promises.getSubscription
          .calledWith(this.activeRecurlySubscription.uuid)
          .should.equal(true)
      })

      it('should redeem the coupon', function () {
        this.RecurlyWrapper.promises.redeemCoupon
          .calledWith(
            this.activeRecurlySubscription.account.account_code,
            this.coupon_code
          )
          .should.equal(true)
      })

      it('should update the subscription', function () {
        expect(
          this.RecurlyClient.promises.changeSubscriptionByUuid
        ).to.be.calledWith(this.subscription.recurlySubscription_id)
        const updateOptions =
          this.RecurlyClient.promises.changeSubscriptionByUuid.args[0][1]
        updateOptions.planCode.should.equal(this.plan_code)
      })
    })
  })

  describe('cancelSubscription', function () {
    describe('with a user without a subscription', function () {
      beforeEach(async function () {
        this.LimitationsManager.promises.userHasV2Subscription.resolves({
          hasSubscription: false,
          subscription: this.subscription,
        })
        await this.SubscriptionHandler.promises.cancelSubscription(this.user)
      })

      it('should redirect to the subscription dashboard', function () {
        this.RecurlyClient.promises.cancelSubscriptionByUuid.called.should.equal(
          false
        )
      })
    })

    describe('with a user with a subscription', function () {
      beforeEach(async function () {
        this.LimitationsManager.promises.userHasV2Subscription.resolves({
          hasSubscription: true,
          subscription: this.subscription,
        })
        await this.SubscriptionHandler.promises.cancelSubscription(this.user)
      })

      it('should cancel the subscription', function () {
        this.RecurlyClient.promises.cancelSubscriptionByUuid.called.should.equal(
          true
        )
        this.RecurlyClient.promises.cancelSubscriptionByUuid
          .calledWith(this.subscription.recurlySubscription_id)
          .should.equal(true)
      })

      it('should send the email after 1 hour', function () {
        const ONE_HOUR_IN_MS = 1000 * 60 * 60
        expect(this.EmailHandler.sendDeferredEmail).to.have.been.calledWith(
          'canceledSubscription',
          { to: this.user.email, first_name: this.user.first_name },
          ONE_HOUR_IN_MS
        )
      })
    })
  })

  describe('reactivateSubscription', function () {
    describe('with a user without a subscription', function () {
      beforeEach(async function () {
        this.LimitationsManager.promises.userHasV2Subscription.resolves({
          hasSubscription: false,
          subscription: this.subscription,
        })
        await this.SubscriptionHandler.promises.reactivateSubscription(
          this.user
        )
      })

      it('should redirect to the subscription dashboard', function () {
        this.RecurlyClient.promises.reactivateSubscriptionByUuid.called.should.equal(
          false
        )
      })

      it('should not send a notification email', function () {
        sinon.assert.notCalled(this.EmailHandler.sendEmail)
      })
    })

    describe('with a user with a subscription', function () {
      beforeEach(async function () {
        this.LimitationsManager.promises.userHasV2Subscription.resolves({
          hasSubscription: true,
          subscription: this.subscription,
        })
        await this.SubscriptionHandler.promises.reactivateSubscription(
          this.user
        )
      })

      it('should reactivate the subscription', function () {
        this.RecurlyClient.promises.reactivateSubscriptionByUuid.called.should.equal(
          true
        )
        this.RecurlyClient.promises.reactivateSubscriptionByUuid
          .calledWith(this.subscription.recurlySubscription_id)
          .should.equal(true)
      })

      it('should send a notification email', function () {
        sinon.assert.calledWith(
          this.EmailHandler.sendEmail,
          'reactivatedSubscription'
        )
      })
    })
  })

  describe('syncSubscription', function () {
    describe('with an actionable request', function () {
      beforeEach(async function () {
        this.user.id = this.activeRecurlySubscription.account.account_code

        this.User.findById = (userId, projection) => ({
          exec: () => {
            userId.should.equal(this.user.id)
            return Promise.resolve(this.user)
          },
        })

        await this.SubscriptionHandler.promises.syncSubscription(
          this.activeRecurlySubscription,
          {}
        )
      })

      it('should request the affected subscription from the API', function () {
        this.RecurlyWrapper.promises.getSubscription
          .calledWith(this.activeRecurlySubscription.uuid)
          .should.equal(true)
      })

      it('should request the account details of the subscription', function () {
        const options = this.RecurlyWrapper.promises.getSubscription.args[0][1]
        options.includeAccount.should.equal(true)
      })

      it('should sync the subscription to the user', function () {
        this.SubscriptionUpdater.promises.syncSubscription.calledOnce.should.equal(
          true
        )
        this.SubscriptionUpdater.promises.syncSubscription.args[0][0].should.deep.equal(
          this.activeRecurlySubscription
        )
        this.SubscriptionUpdater.promises.syncSubscription.args[0][1].should.deep.equal(
          this.user._id
        )
      })
    })
  })

  describe('attemptPaypalInvoiceCollection', function () {
    describe('for credit card users', function () {
      beforeEach(async function () {
        this.RecurlyWrapper.promises.getBillingInfo.resolves({
          paypal_billing_agreement_id: null,
        })
        await this.SubscriptionHandler.promises.attemptPaypalInvoiceCollection(
          this.activeRecurlySubscription.account.account_code
        )
      })

      it('gets billing infos', function () {
        sinon.assert.calledWith(
          this.RecurlyWrapper.promises.getBillingInfo,
          this.activeRecurlySubscription.account.account_code
        )
      })

      it('skips user', function () {
        sinon.assert.notCalled(
          this.RecurlyWrapper.promises.getAccountPastDueInvoices
        )
      })
    })

    describe('for paypal users', function () {
      beforeEach(async function () {
        this.RecurlyWrapper.promises.getBillingInfo.resolves({
          paypal_billing_agreement_id: 'mock-billing-agreement',
        })
        this.RecurlyWrapper.promises.getAccountPastDueInvoices.resolves([
          { invoice_number: 'mock-invoice-number' },
        ])
        await this.SubscriptionHandler.promises.attemptPaypalInvoiceCollection(
          this.activeRecurlySubscription.account.account_code
        )
      })

      it('gets past due invoices', function () {
        sinon.assert.calledWith(
          this.RecurlyWrapper.promises.getAccountPastDueInvoices,
          this.activeRecurlySubscription.account.account_code
        )
      })

      it('calls attemptInvoiceCollection', function () {
        sinon.assert.calledWith(
          this.RecurlyWrapper.promises.attemptInvoiceCollection,
          'mock-invoice-number'
        )
      })
    })
  })

  describe('validateNoSubscriptionInRecurly', function () {
    describe('with a subscription in recurly', function () {
      beforeEach(async function () {
        this.RecurlyWrapper.promises.listAccountActiveSubscriptions.resolves([
          this.subscription,
        ])
        this.isValid =
          await this.SubscriptionHandler.promises.validateNoSubscriptionInRecurly(
            this.user_id
          )
      })

      it('should call RecurlyWrapper.promises.listAccountActiveSubscriptions with the user id', function () {
        this.RecurlyWrapper.promises.listAccountActiveSubscriptions
          .calledWith(this.user_id)
          .should.equal(true)
      })

      it('should sync the subscription', function () {
        this.SubscriptionUpdater.promises.syncSubscription
          .calledWith(this.subscription, this.user_id)
          .should.equal(true)
      })

      it('should return false', function () {
        expect(this.isValid).to.equal(false)
      })
    })

    describe('with no subscription in recurly', function () {
      beforeEach(async function () {
        this.isValid =
          await this.SubscriptionHandler.promises.validateNoSubscriptionInRecurly(
            this.user_id
          )
      })

      it('should be rejected and not sync the subscription', function () {
        this.SubscriptionUpdater.promises.syncSubscription.called.should.equal(
          false
        )
      })

      it('should return true', function () {
        expect(this.isValid).to.equal(true)
      })
    })
  })
})
