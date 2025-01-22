const SandboxedModule = require('sandboxed-module')
const sinon = require('sinon')
const chai = require('chai')
const { expect } = chai
const {
  RecurlySubscription,
  RecurlySubscriptionChangeRequest,
} = require('../../../../app/src/Features/Subscription/RecurlyEntities')

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
  'subscription-123-active': new RecurlySubscription({
    id: 'subscription-123-active',
    userId: 'user-id',
    planCode: 'collaborator',
    planName: 'Collaborator',
    planPrice: 10,
    subtotal: 10,
    currency: 'USD',
    total: 10,
  }),
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
          price_in_cents: 1000,
          features: {
            collaborators: -1,
            versioning: true,
          },
        },
        {
          planCode: 'professional',
          price_in_cents: 1500,
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
        applySubscriptionChangeRequest: sinon
          .stub()
          .resolves(this.activeRecurlySubscriptionChange),
        getSubscription: sinon
          .stub()
          .resolves(this.activeRecurlyClientSubscription),
        pauseSubscriptionByUuid: sinon.stub().resolves(),
        resumeSubscriptionByUuid: sinon.stub().resolves(),
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
        userHasSubscription: sinon.stub().resolves(),
      },
    }

    this.SubscriptionLocator = {
      promises: {
        getUsersSubscription: sinon.stub().resolves(this.subscription),
      },
    }

    this.EmailHandler = {
      sendEmail: sinon.stub(),
      sendDeferredEmail: sinon.stub(),
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
        './SubscriptionLocator': this.SubscriptionLocator,
        './LimitationsManager': this.LimitationsManager,
        '../Email/EmailHandler': this.EmailHandler,
        '../Analytics/AnalyticsManager': this.AnalyticsManager,
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

  describe('updateSubscription', function () {
    describe('with a user with a subscription', function () {
      beforeEach(async function () {
        this.user.id = this.activeRecurlySubscription.account.account_code
        this.User.findById = (userId, projection) => ({
          exec: () => {
            userId.should.equal(this.user.id)
            return Promise.resolve(this.user)
          },
        })
        this.plan_code = 'professional'
        this.LimitationsManager.promises.userHasSubscription.resolves({
          hasSubscription: true,
          subscription: this.subscription,
        })
        await this.SubscriptionHandler.promises.updateSubscription(
          this.user,
          this.plan_code,
          null
        )
      })

      it('should update the subscription', function () {
        expect(
          this.RecurlyClient.promises.applySubscriptionChangeRequest
        ).to.have.been.calledWith(
          new RecurlySubscriptionChangeRequest({
            subscription: this.activeRecurlyClientSubscription,
            timeframe: 'now',
            planCode: this.plan_code,
          })
        )
      })

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
    })

    describe('when plan(s) could not be located in settings', function () {
      beforeEach(async function () {
        this.user.id = this.activeRecurlySubscription.account.account_code
        this.User.findById = (userId, projection) => ({
          exec: () => {
            userId.should.equal(this.user.id)
            return Promise.resolve(this.user)
          },
        })

        this.LimitationsManager.promises.userHasSubscription.resolves({
          hasSubscription: true,
          subscription: this.subscription,
        })
      })

      it('should be rejected and should not update the subscription', function () {
        expect(
          this.SubscriptionHandler.promises.updateSubscription(
            this.user,
            'unknown-plan',
            null
          )
        ).to.be.rejected
        this.RecurlyClient.promises.applySubscriptionChangeRequest.called.should.equal(
          false
        )
      })
    })

    describe('with a user without a subscription', function () {
      beforeEach(async function () {
        this.LimitationsManager.promises.userHasSubscription.resolves(false)
        await this.SubscriptionHandler.promises.updateSubscription(
          this.user,
          this.plan_code,
          null
        )
      })

      it('should redirect to the subscription dashboard', function () {
        this.RecurlyClient.promises.applySubscriptionChangeRequest.called.should.equal(
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
        this.LimitationsManager.promises.userHasSubscription.resolves({
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
          this.RecurlyClient.promises.applySubscriptionChangeRequest
        ).to.be.calledWith(
          new RecurlySubscriptionChangeRequest({
            subscription: this.activeRecurlyClientSubscription,
            timeframe: 'now',
            planCode: this.plan_code,
          })
        )
      })
    })
  })

  describe('cancelSubscription', function () {
    describe('with a user without a subscription', function () {
      beforeEach(async function () {
        this.LimitationsManager.promises.userHasSubscription.resolves({
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
        this.LimitationsManager.promises.userHasSubscription.resolves({
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

  describe('resumeSubscription', function () {
    describe('for a user without a subscription', function () {
      beforeEach(async function () {
        this.LimitationsManager.promises.userHasSubscription.resolves({
          hasSubscription: false,
          subscription: this.subscription,
        })
      })
      it('should not make a resume call to recurly', async function () {
        expect(
          this.SubscriptionHandler.promises.resumeSubscription(this.user)
        ).to.be.rejectedWith('No active subscription to resume')
        this.RecurlyClient.promises.resumeSubscriptionByUuid.called.should.equal(
          false
        )
      })
    })

    describe('for a user with a subscription', function () {
      beforeEach(async function () {
        this.LimitationsManager.promises.userHasSubscription.resolves({
          hasSubscription: true,
          subscription: {
            recurlySubscription_id: this.activeRecurlySubscription.uuid,
            recurlyStatus: { state: 'non-trial' },
            planCode: 'collaborator',
          },
        })
      })
      it('should make a resume call to recurly', async function () {
        await this.SubscriptionHandler.promises.resumeSubscription(this.user)

        this.RecurlyClient.promises.resumeSubscriptionByUuid.called.should.equal(
          true
        )
      })
    })
  })

  describe('pauseSubscription', function () {
    describe('for a user without a subscription', function () {
      beforeEach(async function () {
        this.LimitationsManager.promises.userHasSubscription.resolves({
          hasSubscription: false,
          subscription: this.subscription,
        })
      })
      it('should not make a pause call to recurly', async function () {
        expect(
          this.SubscriptionHandler.promises.pauseSubscription(this.user, 3)
        ).to.be.rejectedWith('No active subscription to pause')
        this.RecurlyClient.promises.pauseSubscriptionByUuid.called.should.equal(
          false
        )
      })
    })

    describe('for a user with an annual subscription', function () {
      beforeEach(async function () {
        this.LimitationsManager.promises.userHasSubscription.resolves({
          hasSubscription: false,
          subscription: {
            recurlySubscription_id: this.activeRecurlySubscription.uuid,
            recurlyStatus: { state: 'non-trial' },
            planCode: 'collaborator-annual',
          },
        })
      })
      it('should not make a pause call to recurly', async function () {
        expect(
          this.SubscriptionHandler.promises.pauseSubscription(this.user, 3)
        ).to.be.rejectedWith('Can only pause monthly individual plans')
        this.RecurlyClient.promises.pauseSubscriptionByUuid.called.should.equal(
          false
        )
      })
    })

    describe('for a user with a subscription', function () {
      beforeEach(async function () {
        this.LimitationsManager.promises.userHasSubscription.resolves({
          hasSubscription: true,
          subscription: {
            recurlySubscription_id: this.activeRecurlySubscription.uuid,
            recurlyStatus: { state: 'non-trial' },
            planCode: 'collaborator',
            addOns: [],
          },
        })
      })
      it('should make a pause call to recurly', async function () {
        await this.SubscriptionHandler.promises.pauseSubscription(this.user, 3)

        this.RecurlyClient.promises.pauseSubscriptionByUuid.called.should.equal(
          true
        )
      })
    })

    describe('for a user in a trial', function () {
      beforeEach(async function () {
        this.LimitationsManager.promises.userHasSubscription.resolves({
          hasSubscription: true,
          subscription: {
            recurlySubscription_id: this.activeRecurlySubscription.uuid,
            recurlyStatus: {
              state: 'trial',
              trialEndsAt: Date.now() + 1000000,
            },
            planCode: 'collaborator',
          },
        })
      })
      it('should not make a pause call to recurly', async function () {
        expect(
          this.SubscriptionHandler.promises.pauseSubscription(this.user, 3)
        ).to.be.rejectedWith('Cannot pause a subscription in a trial')
        this.RecurlyClient.promises.pauseSubscriptionByUuid.called.should.equal(
          false
        )
      })
    })

    describe('for a user with addons', function () {
      beforeEach(async function () {
        this.LimitationsManager.promises.userHasSubscription.resolves({
          hasSubscription: true,
          subscription: {
            recurlySubscription_id: this.activeRecurlySubscription.uuid,
            recurlyStatus: { state: 'non-trial' },
            planCode: 'collaborator',
            addOns: ['mock-addon'],
          },
        })
      })
      it('should not make a pause call to recurly', async function () {
        expect(
          this.SubscriptionHandler.promises.pauseSubscription(this.user, 3)
        ).to.be.rejectedWith('Cannot pause a subscription with addons')
        this.RecurlyClient.promises.pauseSubscriptionByUuid.called.should.equal(
          false
        )
      })
    })
  })

  describe('reactivateSubscription', function () {
    describe('with a user without a subscription', function () {
      beforeEach(async function () {
        this.LimitationsManager.promises.userHasSubscription.resolves({
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
        this.LimitationsManager.promises.userHasSubscription.resolves({
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
