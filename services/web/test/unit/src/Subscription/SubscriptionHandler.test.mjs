import { expect, vi } from 'vitest'
import sinon from 'sinon'
import PaymentProviderEntities from '../../../../app/src/Features/Subscription/PaymentProviderEntities.mjs'
import SubscriptionHelper from '../../../../app/src/Features/Subscription/SubscriptionHelper.mjs'
import { AI_ADD_ON_CODE } from '../../../../app/src/Features/Subscription/AiHelper.mjs'

const { PaymentProviderSubscription } = PaymentProviderEntities
const MODULE_PATH =
  '../../../../app/src/Features/Subscription/SubscriptionHandler'

const mockRecurlySubscriptions = {
  'subscription-123-active': {
    uuid: 'subscription-123-active',
    plan: {
      name: 'Collaborator',
      plan_code: 'collaborator',
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
  'subscription-123-active': new PaymentProviderSubscription({
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
  beforeEach(async function (ctx) {
    ctx.Settings = {
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
    ctx.activeRecurlySubscription =
      mockRecurlySubscriptions['subscription-123-active']
    ctx.activeRecurlyClientSubscription =
      mockRecurlyClientSubscriptions['subscription-123-active']
    ctx.activeRecurlySubscriptionChange =
      mockSubscriptionChanges['subscription-123-active']
    ctx.User = {}
    ctx.user = { _id: (ctx.user_id = 'user_id_here_') }
    ctx.subscription = {
      recurlySubscription_id: ctx.activeRecurlySubscription.uuid,
    }
    ctx.RecurlyWrapper = {
      promises: {
        getSubscription: sinon.stub().resolves(ctx.activeRecurlySubscription),
        redeemCoupon: sinon.stub().resolves(),
        createSubscription: sinon
          .stub()
          .resolves(ctx.activeRecurlySubscription),
        getBillingInfo: sinon.stub().resolves(),
        getAccountPastDueInvoices: sinon.stub().resolves(),
        attemptInvoiceCollection: sinon.stub().resolves(),
        listAccountActiveSubscriptions: sinon.stub().resolves([]),
      },
    }
    ctx.RecurlyClient = {
      promises: {
        reactivateSubscriptionByUuid: sinon
          .stub()
          .resolves(ctx.activeRecurlyClientSubscription),
        cancelSubscriptionByUuid: sinon.stub().resolves(),
        applySubscriptionChangeRequest: sinon
          .stub()
          .resolves(ctx.activeRecurlySubscriptionChange),
        getSubscription: sinon
          .stub()
          .resolves(ctx.activeRecurlyClientSubscription),
        pauseSubscriptionByUuid: sinon.stub().resolves(),
        resumeSubscriptionByUuid: sinon.stub().resolves(),
        failInvoice: sinon.stub(),
        getPastDueInvoices: sinon.stub(),
      },
    }
    ctx.SubscriptionUpdater = {
      promises: {
        updateSubscriptionFromRecurly: sinon.stub().resolves(),
        syncSubscription: sinon.stub().resolves(),
        syncStripeSubscription: sinon.stub().resolves(),
        startFreeTrial: sinon.stub().resolves(),
        setSubscriptionWasReverted: sinon.stub().resolves(),
      },
    }

    ctx.LimitationsManager = {
      promises: {
        userHasSubscription: sinon.stub().resolves(),
      },
    }

    ctx.SubscriptionLocator = {
      promises: {
        getUsersSubscription: sinon.stub().resolves(ctx.subscription),
      },
    }

    ctx.EmailHandler = {
      sendEmail: sinon.stub(),
      sendDeferredEmail: sinon.stub(),
    }

    ctx.UserUpdater = {
      promises: {
        updateUser: sinon.stub().resolves(),
      },
    }

    ctx.SplitTestHandler = {
      promises: {
        getAssignmentForUser: sinon.stub().resolves({ variant: 'default' }),
      },
    }

    vi.doMock(
      '../../../../app/src/Features/Subscription/RecurlyWrapper',
      () => ({
        default: ctx.RecurlyWrapper,
      })
    )

    vi.doMock(
      '../../../../app/src/Features/Subscription/RecurlyClient',
      () => ({
        default: ctx.RecurlyClient,
      })
    )

    vi.doMock('@overleaf/settings', () => ({
      default: ctx.Settings,
    }))

    vi.doMock('../../../../app/src/models/User', () => ({
      User: ctx.User,
    }))

    vi.doMock(
      '../../../../app/src/Features/Subscription/SubscriptionHelper',
      () => ({
        default: SubscriptionHelper,
      })
    )

    vi.doMock(
      '../../../../app/src/Features/Subscription/SubscriptionUpdater',
      () => ({
        default: ctx.SubscriptionUpdater,
      })
    )

    vi.doMock(
      '../../../../app/src/Features/Subscription/SubscriptionLocator',
      () => ({
        default: ctx.SubscriptionLocator,
      })
    )

    vi.doMock(
      '../../../../app/src/Features/Subscription/LimitationsManager',
      () => ({
        default: ctx.LimitationsManager,
      })
    )

    vi.doMock('../../../../app/src/Features/Email/EmailHandler', () => ({
      default: ctx.EmailHandler,
    }))

    vi.doMock(
      '../../../../app/src/Features/Analytics/AnalyticsManager',
      () => ({
        default: ctx.AnalyticsManager,
      })
    )

    vi.doMock('../../../../app/src/Features/User/UserUpdater', () => ({
      default: ctx.UserUpdater,
    }))

    vi.doMock(
      '../../../../app/src/Features/SplitTests/SplitTestHandler',
      () => ({
        default: ctx.SplitTestHandler,
      })
    )

    vi.doMock('../../../../app/src/infrastructure/Modules', () => ({
      default: (ctx.Modules = {
        promises: {
          hooks: {
            fire: sinon.stub(),
          },
        },
      }),
    }))

    ctx.SubscriptionHandler = (await import(MODULE_PATH)).default
  })

  describe('createSubscription', function () {
    beforeEach(function (ctx) {
      ctx.subscriptionDetails = {
        cvv: '123',
        number: '12345',
      }
      ctx.recurlyTokenIds = { billing: '45555666' }
    })

    describe('successfully', function () {
      beforeEach(async function (ctx) {
        await ctx.SubscriptionHandler.promises.createSubscription(
          ctx.user,
          ctx.subscriptionDetails,
          ctx.recurlyTokenIds
        )
      })

      it('should create the subscription with the wrapper', function (ctx) {
        ctx.RecurlyWrapper.promises.createSubscription
          .calledWith(ctx.user, ctx.subscriptionDetails, ctx.recurlyTokenIds)
          .should.equal(true)
      })

      it('should sync the subscription to the user', function (ctx) {
        ctx.SubscriptionUpdater.promises.syncSubscription.calledOnce.should.equal(
          true
        )
        ctx.SubscriptionUpdater.promises.syncSubscription.args[0][0].should.deep.equal(
          ctx.activeRecurlySubscription
        )
        ctx.SubscriptionUpdater.promises.syncSubscription.args[0][1].should.deep.equal(
          ctx.user._id
        )
      })

      it('should not set last trial date if not a trial/the trial_started_at is not set', function (ctx) {
        ctx.UserUpdater.promises.updateUser.should.not.have.been.called
      })
    })

    describe('when the subscription is a trial and has a trial_started_at date', function () {
      beforeEach(async function (ctx) {
        ctx.activeRecurlySubscription.trial_started_at =
          '2024-01-01T09:58:35.531+00:00'
        await ctx.SubscriptionHandler.promises.createSubscription(
          ctx.user,
          ctx.subscriptionDetails,
          ctx.recurlyTokenIds
        )
      })
      it('should set the users lastTrial date', function (ctx) {
        ctx.UserUpdater.promises.updateUser.should.have.been.calledOnce
        expect(ctx.UserUpdater.promises.updateUser.args[0][0]).to.deep.equal({
          _id: ctx.user_id,
          lastTrial: {
            $not: {
              $gt: new Date(ctx.activeRecurlySubscription.trial_started_at),
            },
          },
        })
        expect(ctx.UserUpdater.promises.updateUser.args[0][1]).to.deep.equal({
          $set: {
            lastTrial: new Date(ctx.activeRecurlySubscription.trial_started_at),
          },
        })
      })
    })

    describe('when there is already a subscription in Recurly', function () {
      beforeEach(function (ctx) {
        ctx.RecurlyWrapper.promises.listAccountActiveSubscriptions.resolves([
          ctx.subscription,
        ])
      })

      it('should an error', function (ctx) {
        expect(
          ctx.SubscriptionHandler.promises.createSubscription(
            ctx.user,
            ctx.subscriptionDetails,
            ctx.recurlyTokenIds
          )
        ).to.be.rejectedWith('user already has subscription in recurly')
      })
    })
  })

  describe('updateSubscription', function () {
    beforeEach(function (ctx) {
      ctx.user.id = ctx.activeRecurlySubscription.account.account_code
      ctx.User.findById = (userId, projection) => ({
        exec: () => {
          userId.should.equal(ctx.user.id)
          return Promise.resolve(ctx.user)
        },
      })
    })

    it('should not fire updatePaidSubscription hook if user has no subscription', async function (ctx) {
      ctx.LimitationsManager.promises.userHasSubscription.resolves({
        hasSubscription: false,
        subscription: null,
      })
      await ctx.SubscriptionHandler.promises.updateSubscription(
        ctx.user,
        ctx.plan_code
      )
      expect(ctx.Modules.promises.hooks.fire).to.not.have.been.calledWith(
        'updatePaidSubscription',
        sinon.match.any,
        sinon.match.any,
        sinon.match.any
      )
    })

    it('should not fire updatePaidSubscription hook if user has custom subscription', async function (ctx) {
      ctx.LimitationsManager.promises.userHasSubscription.resolves({
        hasSubscription: true,
        subscription: { customAccount: true },
      })
      await ctx.SubscriptionHandler.promises.updateSubscription(
        ctx.user,
        ctx.plan_code
      )
      expect(ctx.Modules.promises.hooks.fire).to.not.have.been.calledWith(
        'updatePaidSubscription',
        sinon.match.any,
        sinon.match.any,
        sinon.match.any
      )
    })

    it('should fire updatePaidSubscription to update a valid subscription', async function (ctx) {
      ctx.LimitationsManager.promises.userHasSubscription.resolves({
        hasSubscription: true,
        subscription: ctx.subscription,
      })
      await ctx.SubscriptionHandler.promises.updateSubscription(
        ctx.user,
        ctx.plan_code
      )
      expect(ctx.Modules.promises.hooks.fire).to.have.been.calledWith(
        'updatePaidSubscription',
        ctx.subscription,
        ctx.plan_code,
        ctx.user._id
      )
    })
  })

  describe('cancelPendingSubscriptionChange', function () {
    beforeEach(function (ctx) {
      ctx.user.id = ctx.activeRecurlySubscription.account.account_code
      ctx.User.findById = (userId, projection) => ({
        exec: () => {
          userId.should.equal(ctx.user.id)
          return Promise.resolve(ctx.user)
        },
      })
    })

    it('should not fire cancelPendingPaidSubscriptionChange hook if user has no subscription', async function (ctx) {
      ctx.LimitationsManager.promises.userHasSubscription.resolves({
        hasSubscription: false,
        subscription: null,
      })
      await ctx.SubscriptionHandler.promises.cancelPendingSubscriptionChange(
        ctx.user,
        ctx.plan_code
      )
      expect(ctx.Modules.promises.hooks.fire).to.not.have.been.calledWith(
        'cancelPendingPaidSubscriptionChange',
        sinon.match.any
      )
    })

    it('should fire cancelPendingPaidSubscriptionChange to update a valid subscription', async function (ctx) {
      ctx.LimitationsManager.promises.userHasSubscription.resolves({
        hasSubscription: true,
        subscription: ctx.subscription,
      })
      await ctx.SubscriptionHandler.promises.cancelPendingSubscriptionChange(
        ctx.user,
        ctx.plan_code
      )
      expect(ctx.Modules.promises.hooks.fire).to.have.been.calledWith(
        'cancelPendingPaidSubscriptionChange',
        ctx.subscription
      )
    })
  })

  describe('removeAddon', function () {
    beforeEach(function (ctx) {
      ctx.addOnCode = AI_ADD_ON_CODE
    })

    describe('when split test is disabled', function () {
      beforeEach(async function (ctx) {
        ctx.SplitTestHandler.promises.getAssignmentForUser.resolves({
          variant: 'control',
        })
        await ctx.SubscriptionHandler.promises.removeAddon(
          ctx.user,
          ctx.addOnCode
        )
      })

      it('should remove the addon', function (ctx) {
        expect(ctx.Modules.promises.hooks.fire).to.have.been.calledWith(
          'removeAddOn',
          ctx.user._id,
          ctx.addOnCode
        )
      })

      it('should send the email after 1 hour', function (ctx) {
        const ONE_HOUR_IN_MS = 1000 * 60 * 60
        expect(ctx.EmailHandler.sendDeferredEmail).to.have.been.calledWith(
          'canceledSubscription',
          { to: ctx.user.email, first_name: ctx.user.first_name },
          ONE_HOUR_IN_MS
        )
      })
    })

    describe('when split test is enabled', function () {
      beforeEach(async function (ctx) {
        ctx.SplitTestHandler.promises.getAssignmentForUser.resolves({
          variant: 'enabled',
        })
        await ctx.SubscriptionHandler.promises.removeAddon(
          ctx.user,
          ctx.addOnCode
        )
      })

      it('should remove the addon', function (ctx) {
        expect(ctx.Modules.promises.hooks.fire).to.have.been.calledWith(
          'removeAddOn',
          ctx.user._id,
          ctx.addOnCode
        )
      })

      it('should send the email after 1 hour', function (ctx) {
        const ONE_HOUR_IN_MS = 1000 * 60 * 60
        expect(ctx.EmailHandler.sendDeferredEmail).to.have.been.calledWith(
          'canceledSubscriptionOrAddOn',
          { to: ctx.user.email, first_name: ctx.user.first_name },
          ONE_HOUR_IN_MS
        )
      })
    })

    describe('when addon is not AI assistant', function () {
      beforeEach(async function (ctx) {
        ctx.addOnCode = 'other-addon'
        await ctx.SubscriptionHandler.promises.removeAddon(
          ctx.user,
          ctx.addOnCode
        )
      })

      it('should remove the addon', function (ctx) {
        expect(ctx.Modules.promises.hooks.fire).to.have.been.calledWith(
          'removeAddOn',
          ctx.user._id,
          ctx.addOnCode
        )
      })

      it('should not send an email', function (ctx) {
        expect(ctx.EmailHandler.sendDeferredEmail).to.not.have.been.called
      })
    })
  })

  describe('cancelSubscription', function () {
    describe('with a user without a subscription', function () {
      beforeEach(async function (ctx) {
        ctx.LimitationsManager.promises.userHasSubscription.resolves({
          hasSubscription: false,
          subscription: ctx.subscription,
        })
        await ctx.SubscriptionHandler.promises.cancelSubscription(ctx.user)
      })

      it('should redirect to the subscription dashboard', function (ctx) {
        ctx.RecurlyClient.promises.cancelSubscriptionByUuid.called.should.equal(
          false
        )
      })
    })

    describe('with a user with a subscription', function () {
      beforeEach(async function (ctx) {
        ctx.LimitationsManager.promises.userHasSubscription.resolves({
          hasSubscription: true,
          subscription: ctx.subscription,
        })
      })

      describe('when split test is disabled', function () {
        beforeEach(async function (ctx) {
          ctx.SplitTestHandler.promises.getAssignmentForUser.resolves({
            variant: 'control',
          })
          await ctx.SubscriptionHandler.promises.cancelSubscription(ctx.user)
        })

        it('should cancel the subscription', function (ctx) {
          expect(ctx.Modules.promises.hooks.fire).to.have.been.calledWith(
            'cancelPaidSubscription',
            ctx.subscription
          )
        })

        it('should send the email after 1 hour', function (ctx) {
          const ONE_HOUR_IN_MS = 1000 * 60 * 60
          expect(ctx.EmailHandler.sendDeferredEmail).to.have.been.calledWith(
            'canceledSubscription',
            { to: ctx.user.email, first_name: ctx.user.first_name },
            ONE_HOUR_IN_MS
          )
        })
      })

      describe('when split test is enabled', function () {
        beforeEach(async function (ctx) {
          ctx.SplitTestHandler.promises.getAssignmentForUser.resolves({
            variant: 'enabled',
          })
          await ctx.SubscriptionHandler.promises.cancelSubscription(ctx.user)
        })

        it('should cancel the subscription', function (ctx) {
          expect(ctx.Modules.promises.hooks.fire).to.have.been.calledWith(
            'cancelPaidSubscription',
            ctx.subscription
          )
        })

        it('should send the email after 1 hour', function (ctx) {
          const ONE_HOUR_IN_MS = 1000 * 60 * 60
          expect(ctx.EmailHandler.sendDeferredEmail).to.have.been.calledWith(
            'canceledSubscriptionOrAddOn',
            { to: ctx.user.email, first_name: ctx.user.first_name },
            ONE_HOUR_IN_MS
          )
        })
      })
    })
  })

  describe('resumeSubscription', function () {
    describe('for a user without a subscription', function () {
      beforeEach(async function (ctx) {
        ctx.LimitationsManager.promises.userHasSubscription.resolves({
          hasSubscription: false,
          subscription: ctx.subscription,
        })
      })
      it('should not make a resume call to recurly', async function (ctx) {
        expect(
          ctx.SubscriptionHandler.promises.resumeSubscription(ctx.user)
        ).to.be.rejectedWith('No active subscription to resume')
        ctx.RecurlyClient.promises.resumeSubscriptionByUuid.called.should.equal(
          false
        )
      })
    })

    describe('for a user with a subscription', function () {
      beforeEach(async function (ctx) {
        ctx.LimitationsManager.promises.userHasSubscription.resolves({
          hasSubscription: true,
          subscription: {
            recurlySubscription_id: ctx.activeRecurlySubscription.uuid,
            recurlyStatus: { state: 'non-trial' },
            planCode: 'collaborator',
          },
        })
      })
      it('should call resume hook', async function (ctx) {
        await ctx.SubscriptionHandler.promises.resumeSubscription(ctx.user)

        expect(ctx.Modules.promises.hooks.fire).to.have.been.calledWith(
          'resumePaidSubscription',
          {
            recurlySubscription_id: ctx.activeRecurlySubscription.uuid,
            recurlyStatus: { state: 'non-trial' },
            planCode: 'collaborator',
          }
        )
      })
    })
  })

  describe('pauseSubscription', function () {
    describe('for a user without a subscription', function () {
      beforeEach(async function (ctx) {
        ctx.LimitationsManager.promises.userHasSubscription.resolves({
          hasSubscription: false,
          subscription: ctx.subscription,
        })
      })
      it('should not make a pause call to recurly', async function (ctx) {
        expect(
          ctx.SubscriptionHandler.promises.pauseSubscription(ctx.user, 3)
        ).to.be.rejectedWith('No active subscription to pause')
        ctx.RecurlyClient.promises.pauseSubscriptionByUuid.called.should.equal(
          false
        )
      })
    })

    describe('for a user with an annual subscription', function () {
      beforeEach(async function (ctx) {
        ctx.LimitationsManager.promises.userHasSubscription.resolves({
          hasSubscription: false,
          subscription: {
            recurlySubscription_id: ctx.activeRecurlySubscription.uuid,
            recurlyStatus: { state: 'non-trial' },
            planCode: 'collaborator-annual',
          },
        })
      })
      it('should not make a pause call to recurly', async function (ctx) {
        expect(
          ctx.SubscriptionHandler.promises.pauseSubscription(ctx.user, 3)
        ).to.be.rejectedWith('Can only pause monthly individual plans')
        ctx.RecurlyClient.promises.pauseSubscriptionByUuid.called.should.equal(
          false
        )
      })
    })

    describe('for a user with a subscription', function () {
      beforeEach(async function (ctx) {
        ctx.LimitationsManager.promises.userHasSubscription.resolves({
          hasSubscription: true,
          subscription: {
            recurlySubscription_id: ctx.activeRecurlySubscription.uuid,
            recurlyStatus: { state: 'non-trial' },
            planCode: 'collaborator',
            addOns: [],
          },
        })
      })
      it('should call pause hook', async function (ctx) {
        await ctx.SubscriptionHandler.promises.pauseSubscription(ctx.user, 3)

        expect(ctx.Modules.promises.hooks.fire).to.have.been.calledWith(
          'pausePaidSubscription',
          {
            recurlySubscription_id: ctx.activeRecurlySubscription.uuid,
            recurlyStatus: { state: 'non-trial' },
            planCode: 'collaborator',
            addOns: [],
          },
          3
        )
      })
    })

    describe('for a user in a trial', function () {
      beforeEach(async function (ctx) {
        ctx.LimitationsManager.promises.userHasSubscription.resolves({
          hasSubscription: true,
          subscription: {
            recurlySubscription_id: ctx.activeRecurlySubscription.uuid,
            recurlyStatus: {
              state: 'trial',
              trialEndsAt: Date.now() + 1000000,
            },
            planCode: 'collaborator',
          },
        })
      })
      it('should not make a pause call to recurly', async function (ctx) {
        expect(
          ctx.SubscriptionHandler.promises.pauseSubscription(ctx.user, 3)
        ).to.be.rejectedWith('Cannot pause a subscription in a trial')
        ctx.RecurlyClient.promises.pauseSubscriptionByUuid.called.should.equal(
          false
        )
      })
    })

    describe('for a user with addons', function () {
      beforeEach(async function (ctx) {
        ctx.LimitationsManager.promises.userHasSubscription.resolves({
          hasSubscription: true,
          subscription: {
            recurlySubscription_id: ctx.activeRecurlySubscription.uuid,
            recurlyStatus: { state: 'non-trial' },
            planCode: 'collaborator',
            addOns: ['mock-addon'],
          },
        })
      })
      it('should not make a pause call to recurly', async function (ctx) {
        expect(
          ctx.SubscriptionHandler.promises.pauseSubscription(ctx.user, 3)
        ).to.be.rejectedWith('Cannot pause a subscription with addons')
        ctx.RecurlyClient.promises.pauseSubscriptionByUuid.called.should.equal(
          false
        )
      })
    })
  })

  describe('reactivateSubscription', function () {
    describe('with a user without a subscription', function () {
      beforeEach(async function (ctx) {
        ctx.LimitationsManager.promises.userHasSubscription.resolves({
          hasSubscription: false,
          subscription: ctx.subscription,
        })
        await ctx.SubscriptionHandler.promises.reactivateSubscription(ctx.user)
      })

      it('should redirect to the subscription dashboard', function (ctx) {
        ctx.RecurlyClient.promises.reactivateSubscriptionByUuid.called.should.equal(
          false
        )
      })

      it('should not send a notification email', function (ctx) {
        sinon.assert.notCalled(ctx.EmailHandler.sendEmail)
      })
    })

    describe('with a user with a subscription', function () {
      beforeEach(async function (ctx) {
        ctx.LimitationsManager.promises.userHasSubscription.resolves({
          hasSubscription: true,
          subscription: ctx.subscription,
        })
        await ctx.SubscriptionHandler.promises.reactivateSubscription(ctx.user)
      })

      it('should reactivate the subscription', function (ctx) {
        expect(ctx.Modules.promises.hooks.fire).to.have.been.calledWith(
          'reactivatePaidSubscription',
          ctx.subscription
        )
      })

      it('should send a notification email', function (ctx) {
        sinon.assert.calledWith(
          ctx.EmailHandler.sendEmail,
          'reactivatedSubscription'
        )
      })
    })
  })

  describe('syncSubscription', function () {
    describe('with an actionable request', function () {
      beforeEach(async function (ctx) {
        ctx.user.id = ctx.activeRecurlySubscription.account.account_code

        ctx.User.findById = (userId, projection) => ({
          exec: () => {
            userId.should.equal(ctx.user.id)
            return Promise.resolve(ctx.user)
          },
        })

        await ctx.SubscriptionHandler.promises.syncSubscription(
          ctx.activeRecurlySubscription,
          {}
        )
      })

      it('should request the affected subscription from the API', function (ctx) {
        ctx.RecurlyWrapper.promises.getSubscription
          .calledWith(ctx.activeRecurlySubscription.uuid)
          .should.equal(true)
      })

      it('should request the account details of the subscription', function (ctx) {
        const options = ctx.RecurlyWrapper.promises.getSubscription.args[0][1]
        options.includeAccount.should.equal(true)
      })

      it('should sync the subscription to the user', function (ctx) {
        ctx.SubscriptionUpdater.promises.syncSubscription.calledOnce.should.equal(
          true
        )
        ctx.SubscriptionUpdater.promises.syncSubscription.args[0][0].should.deep.equal(
          ctx.activeRecurlySubscription
        )
        ctx.SubscriptionUpdater.promises.syncSubscription.args[0][1].should.deep.equal(
          ctx.user._id
        )
      })
    })
  })

  describe('attemptPaypalInvoiceCollection', function () {
    describe('for credit card users', function () {
      beforeEach(async function (ctx) {
        ctx.RecurlyWrapper.promises.getBillingInfo.resolves({
          paypal_billing_agreement_id: null,
        })
        await ctx.SubscriptionHandler.promises.attemptPaypalInvoiceCollection(
          ctx.activeRecurlySubscription.account.account_code
        )
      })

      it('gets billing infos', function (ctx) {
        sinon.assert.calledWith(
          ctx.RecurlyWrapper.promises.getBillingInfo,
          ctx.activeRecurlySubscription.account.account_code
        )
      })

      it('skips user', function (ctx) {
        sinon.assert.notCalled(
          ctx.RecurlyWrapper.promises.getAccountPastDueInvoices
        )
      })
    })

    describe('for paypal users', function () {
      beforeEach(async function (ctx) {
        ctx.RecurlyWrapper.promises.getBillingInfo.resolves({
          paypal_billing_agreement_id: 'mock-billing-agreement',
        })
        ctx.RecurlyWrapper.promises.getAccountPastDueInvoices.resolves([
          { invoice_number: 'mock-invoice-number' },
        ])
        await ctx.SubscriptionHandler.promises.attemptPaypalInvoiceCollection(
          ctx.activeRecurlySubscription.account.account_code
        )
      })

      it('gets past due invoices', function (ctx) {
        sinon.assert.calledWith(
          ctx.RecurlyWrapper.promises.getAccountPastDueInvoices,
          ctx.activeRecurlySubscription.account.account_code
        )
      })

      it('calls attemptInvoiceCollection', function (ctx) {
        sinon.assert.calledWith(
          ctx.RecurlyWrapper.promises.attemptInvoiceCollection,
          'mock-invoice-number'
        )
      })
    })
  })

  describe('validateNoSubscriptionInRecurly', function () {
    describe('with a subscription in recurly', function () {
      beforeEach(async function (ctx) {
        ctx.RecurlyWrapper.promises.listAccountActiveSubscriptions.resolves([
          ctx.subscription,
        ])
        ctx.isValid =
          await ctx.SubscriptionHandler.promises.validateNoSubscriptionInRecurly(
            ctx.user_id
          )
      })

      it('should call RecurlyWrapper.promises.listAccountActiveSubscriptions with the user id', function (ctx) {
        ctx.RecurlyWrapper.promises.listAccountActiveSubscriptions
          .calledWith(ctx.user_id)
          .should.equal(true)
      })

      it('should sync the subscription', function (ctx) {
        ctx.SubscriptionUpdater.promises.syncSubscription
          .calledWith(ctx.subscription, ctx.user_id)
          .should.equal(true)
      })

      it('should return false', function (ctx) {
        expect(ctx.isValid).to.equal(false)
      })
    })

    describe('with no subscription in recurly', function () {
      beforeEach(async function (ctx) {
        ctx.isValid =
          await ctx.SubscriptionHandler.promises.validateNoSubscriptionInRecurly(
            ctx.user_id
          )
      })

      it('should be rejected and not sync the subscription', function (ctx) {
        ctx.SubscriptionUpdater.promises.syncSubscription.called.should.equal(
          false
        )
      })

      it('should return true', function (ctx) {
        expect(ctx.isValid).to.equal(true)
      })
    })
  })

  describe('revertPlanChange', function () {
    describe('with correct invoices', function () {
      beforeEach(async function (ctx) {
        ctx.subscriptionRestorePoint = {
          planCode: 'collaborator',
          addOns: [
            { addOnCode: 'addon-1', quantity: 1, unitAmountInCents: 500 },
          ],
          _id: 'restore-point-id',
        }
        ctx.pastDueInvoice = {
          id: 'invoice-123',
          dueAt: new Date(),
          collectionMethod: 'automatic',
        }
        ctx.user.id = ctx.activeRecurlySubscription.account.account_code
        ctx.User.findById = (userId, projection) => ({
          exec: () => {
            userId.should.equal(ctx.user.id)
            return Promise.resolve(ctx.user)
          },
        })
        ctx.RecurlyClient.promises.getSubscription.resolves(
          ctx.activeRecurlyClientSubscription
        )
        ctx.RecurlyClient.promises.getPastDueInvoices.resolves([
          ctx.pastDueInvoice,
        ])
        ctx.RecurlyClient.promises.failInvoice.resolves()
        ctx.SubscriptionUpdater.promises.setSubscriptionWasReverted.resolves()
        ctx.RecurlyClient.promises.applySubscriptionChangeRequest.resolves()

        await ctx.SubscriptionHandler.promises.revertPlanChange(
          ctx.activeRecurlyClientSubscription.id,
          ctx.subscriptionRestorePoint
        )
      })

      it('should fetch the subscription from recurly', async function (ctx) {
        expect(
          ctx.RecurlyClient.promises.getSubscription.calledWith(
            ctx.activeRecurlyClientSubscription.id
          )
        ).to.be.true
      })

      it('should fail the invoice', async function (ctx) {
        expect(
          ctx.RecurlyClient.promises.failInvoice.calledWith(
            ctx.pastDueInvoice.id
          )
        ).to.be.true
      })

      it('should call setSubscriptionWasReverted', async function (ctx) {
        expect(
          ctx.SubscriptionUpdater.promises.setSubscriptionWasReverted.calledWith(
            ctx.subscriptionRestorePoint._id
          )
        ).to.be.true
      })

      it('should sync the subscription', async function (ctx) {
        ctx.SubscriptionUpdater.promises.syncSubscription.calledOnce.should.equal(
          true
        )
        ctx.SubscriptionUpdater.promises.syncSubscription.args[0][0].should.deep.equal(
          ctx.activeRecurlySubscription
        )
        ctx.SubscriptionUpdater.promises.syncSubscription.args[0][1].should.deep.equal(
          ctx.user._id
        )
      })
    })

    describe('should throw an IndeterminateInvoiceError when', function () {
      beforeEach(function (ctx) {
        ctx.subscriptionRestorePoint = {
          planCode: 'collaborator',
          addOns: [
            { addOnCode: 'addon-1', quantity: 1, unitAmountInCents: 500 },
          ],
          _id: 'restore-point-id',
        }
        ctx.RecurlyClient.promises.getSubscription.resolves(
          ctx.activeRecurlyClientSubscription
        )
      })

      it('finds a past due invoice older than 24 hours', async function (ctx) {
        const oldInvoice = {
          id: 'invoice-123',
          dueAt: new Date(Date.now() - 25 * 60 * 60 * 1000), // 25 hours ago
          collectionMethod: 'automatic',
        }
        ctx.RecurlyClient.promises.getPastDueInvoices.resolves([oldInvoice])

        await expect(
          ctx.SubscriptionHandler.promises.revertPlanChange(
            ctx.activeRecurlyClientSubscription.id,
            ctx.subscriptionRestorePoint
          )
        ).to.be.rejectedWith('cant determine invoice to fail for plan revert')
      })

      it('finds more than one past due invoice', async function (ctx) {
        const invoices = [
          {
            id: 'invoice-123',
            dueAt: new Date(),
            collectionMethod: 'automatic',
          },
          {
            id: 'invoice-456',
            dueAt: new Date(),
            collectionMethod: 'automatic',
          },
        ]
        ctx.RecurlyClient.promises.getPastDueInvoices.resolves(invoices)

        await expect(
          ctx.SubscriptionHandler.promises.revertPlanChange(
            ctx.activeRecurlyClientSubscription.id,
            ctx.subscriptionRestorePoint
          )
        ).to.be.rejectedWith('cant determine invoice to fail for plan revert')
      })

      it('finds an invoice with a collectionMethod other than automatic', async function (ctx) {
        const manualInvoice = {
          id: 'invoice-123',
          dueAt: new Date(),
          collectionMethod: 'manual',
        }
        ctx.RecurlyClient.promises.getPastDueInvoices.resolves([manualInvoice])

        await expect(
          ctx.SubscriptionHandler.promises.revertPlanChange(
            ctx.activeRecurlyClientSubscription.id,
            ctx.subscriptionRestorePoint
          )
        ).to.be.rejectedWith('cant determine invoice to fail for plan revert')
      })
    })
  })
})
