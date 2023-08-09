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
    this.callback = sinon.stub()

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
      getSubscription: sinon
        .stub()
        .callsArgWith(2, null, this.activeRecurlySubscription),
      redeemCoupon: sinon.stub().callsArgWith(2),
      createSubscription: sinon
        .stub()
        .callsArgWith(3, null, this.activeRecurlySubscription),
      getBillingInfo: sinon.stub().yields(),
      getAccountPastDueInvoices: sinon.stub().yields(),
      attemptInvoiceCollection: sinon.stub().yields(),
      listAccountActiveSubscriptions: sinon.stub().yields(null, []),
      promises: {
        getSubscription: sinon.stub().resolves(this.activeRecurlySubscription),
      },
    }
    this.RecurlyClient = {
      changeSubscriptionByUuid: sinon
        .stub()
        .yields(null, this.activeRecurlySubscriptionChange),
      getSubscription: sinon
        .stub()
        .yields(null, this.activeRecurlyClientSubscription),
      reactivateSubscriptionByUuid: sinon
        .stub()
        .yields(null, this.activeRecurlyClientSubscription),
      cancelSubscriptionByUuid: sinon.stub().yields(),
      promises: {
        reactivateSubscriptionByUuid: sinon
          .stub()
          .resolves(this.activeRecurlyClientSubscription),
        cancelSubscriptionByUuid: sinon.stub().resolves(),
      },
    }

    this.SubscriptionUpdater = {
      syncSubscription: sinon.stub().yields(),
      startFreeTrial: sinon.stub().callsArgWith(1),
      promises: {
        updateSubscriptionFromRecurly: sinon.stub().resolves(),
      },
    }

    this.LimitationsManager = {
      userHasV2Subscription: sinon.stub(),
      promises: {
        userHasV2Subscription: sinon.stub().resolves(),
      },
    }

    this.EmailHandler = {
      sendEmail: sinon.stub(),
      sendDeferredEmail: sinon.stub(),
    }

    this.AnalyticsManager = { recordEventForUser: sinon.stub() }

    this.PlansLocator = {
      findLocalPlanInSettings: sinon.stub().returns({ planCode: 'plan' }),
    }

    this.SubscriptionHelper = {
      shouldPlanChangeAtTermEnd: sinon.stub(),
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
      beforeEach(function () {
        this.SubscriptionHandler.createSubscription(
          this.user,
          this.subscriptionDetails,
          this.recurlyTokenIds,
          this.callback
        )
      })

      it('should create the subscription with the wrapper', function () {
        this.RecurlyWrapper.createSubscription
          .calledWith(this.user, this.subscriptionDetails, this.recurlyTokenIds)
          .should.equal(true)
      })

      it('should sync the subscription to the user', function () {
        this.SubscriptionUpdater.syncSubscription.calledOnce.should.equal(true)
        this.SubscriptionUpdater.syncSubscription.args[0][0].should.deep.equal(
          this.activeRecurlySubscription
        )
        this.SubscriptionUpdater.syncSubscription.args[0][1].should.deep.equal(
          this.user._id
        )
      })
    })

    describe('when there is already a subscription in Recurly', function () {
      beforeEach(function () {
        this.RecurlyWrapper.listAccountActiveSubscriptions.yields(null, [
          this.subscription,
        ])
        this.SubscriptionHandler.createSubscription(
          this.user,
          this.subscriptionDetails,
          this.recurlyTokenIds,
          this.callback
        )
      })

      it('should  an error', function () {
        this.callback.calledWith(
          new Error('user already has subscription in recurly')
        )
      })
    })
  })

  function shouldUpdateSubscription() {
    it('should update the subscription', function () {
      expect(
        this.RecurlyClient.changeSubscriptionByUuid
      ).to.have.been.calledWith(this.subscription.recurlySubscription_id)
      const updateOptions =
        this.RecurlyClient.changeSubscriptionByUuid.args[0][1]
      updateOptions.planCode.should.equal(this.plan_code)
    })
  }

  function shouldSyncSubscription() {
    it('should sync the new subscription to the user', function () {
      expect(this.SubscriptionUpdater.syncSubscription).to.have.been.called
      this.SubscriptionUpdater.syncSubscription.args[0][0].should.deep.equal(
        this.activeRecurlySubscription
      )
      this.SubscriptionUpdater.syncSubscription.args[0][1].should.deep.equal(
        this.user._id
      )
    })
  }

  function testUserWithASubscription(shouldPlanChangeAtTermEnd, timeframe) {
    describe(
      'when change should happen with timeframe ' + timeframe,
      function () {
        beforeEach(function (done) {
          this.user.id = this.activeRecurlySubscription.account.account_code
          this.User.findById = (userId, projection, callback) => {
            userId.should.equal(this.user.id)
            callback(null, this.user)
          }
          this.plan_code = 'collaborator'
          this.SubscriptionHelper.shouldPlanChangeAtTermEnd.returns(
            shouldPlanChangeAtTermEnd
          )
          this.LimitationsManager.userHasV2Subscription.callsArgWith(
            1,
            null,
            true,
            this.subscription
          )
          this.SubscriptionHandler.updateSubscription(
            this.user,
            this.plan_code,
            null,
            done
          )
        })

        shouldUpdateSubscription()
        shouldSyncSubscription()

        it('should update with timeframe ' + timeframe, function () {
          const updateOptions =
            this.RecurlyClient.changeSubscriptionByUuid.args[0][1]
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
        beforeEach(function () {
          this.user.id = this.activeRecurlySubscription.account.account_code
          this.User.findById = (userId, projection, callback) => {
            userId.should.equal(this.user.id)
            callback(null, this.user)
          }
          this.plan_code = 'collaborator'
          this.PlansLocator.findLocalPlanInSettings.returns(null)
          this.LimitationsManager.userHasV2Subscription.callsArgWith(
            1,
            null,
            true,
            this.subscription
          )
          this.SubscriptionHandler.updateSubscription(
            this.user,
            this.plan_code,
            null,
            this.callback
          )
        })

        it('should not update the subscription', function () {
          this.RecurlyClient.changeSubscriptionByUuid.called.should.equal(false)
        })

        it('should return an error to the callback', function () {
          this.callback
            .calledWith(sinon.match.instanceOf(Error))
            .should.equal(true)
        })
      })
    })

    describe('with a user without a subscription', function () {
      beforeEach(function (done) {
        this.LimitationsManager.userHasV2Subscription.callsArgWith(
          1,
          null,
          false
        )
        this.SubscriptionHandler.updateSubscription(
          this.user,
          this.plan_code,
          null,
          done
        )
      })

      it('should redirect to the subscription dashboard', function () {
        this.RecurlyClient.changeSubscriptionByUuid.called.should.equal(false)
        this.SubscriptionUpdater.syncSubscription.called.should.equal(false)
      })
    })

    describe('with a coupon code', function () {
      beforeEach(function (done) {
        this.user.id = this.activeRecurlySubscription.account.account_code
        this.User.findById = (userId, projection, callback) => {
          userId.should.equal(this.user.id)
          callback(null, this.user)
        }
        this.plan_code = 'collaborator'
        this.coupon_code = '1231312'
        this.LimitationsManager.userHasV2Subscription.callsArgWith(
          1,
          null,
          true,
          this.subscription
        )
        this.SubscriptionHandler.updateSubscription(
          this.user,
          this.plan_code,
          this.coupon_code,
          done
        )
      })

      it('should get the users account', function () {
        this.RecurlyWrapper.getSubscription
          .calledWith(this.activeRecurlySubscription.uuid)
          .should.equal(true)
      })

      it('should redeem the coupon', function (done) {
        this.RecurlyWrapper.redeemCoupon
          .calledWith(
            this.activeRecurlySubscription.account.account_code,
            this.coupon_code
          )
          .should.equal(true)
        done()
      })

      it('should update the subscription', function () {
        expect(this.RecurlyClient.changeSubscriptionByUuid).to.be.calledWith(
          this.subscription.recurlySubscription_id
        )
        const updateOptions =
          this.RecurlyClient.changeSubscriptionByUuid.args[0][1]
        updateOptions.planCode.should.equal(this.plan_code)
      })
    })
  })

  describe('cancelSubscription', function () {
    describe('with a user without a subscription', function () {
      beforeEach(function (done) {
        this.LimitationsManager.promises.userHasV2Subscription.callsArgWith(
          1,
          null,
          false,
          this.subscription
        )
        this.SubscriptionHandler.cancelSubscription(this.user, done)
      })

      it('should redirect to the subscription dashboard', function () {
        this.RecurlyClient.cancelSubscriptionByUuid.called.should.equal(false)
      })
    })

    describe('with a user with a subscription', function () {
      beforeEach(function (done) {
        this.LimitationsManager.promises.userHasV2Subscription.resolves({
          hasSubscription: true,
          subscription: this.subscription,
        })
        this.SubscriptionHandler.cancelSubscription(this.user, done)
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
      beforeEach(function (done) {
        this.LimitationsManager.promises.userHasV2Subscription.resolves({
          hasSubscription: false,
          subscription: this.subscription,
        })
        this.SubscriptionHandler.reactivateSubscription(this.user, done)
      })

      it('should redirect to the subscription dashboard', function () {
        this.RecurlyClient.reactivateSubscriptionByUuid.called.should.equal(
          false
        )
      })

      it('should not send a notification email', function () {
        sinon.assert.notCalled(this.EmailHandler.sendEmail)
      })
    })

    describe('with a user with a subscription', function () {
      beforeEach(function (done) {
        this.LimitationsManager.promises.userHasV2Subscription.resolves({
          hasSubscription: true,
          subscription: this.subscription,
        })
        this.SubscriptionHandler.reactivateSubscription(this.user, done)
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
      beforeEach(function (done) {
        this.user.id = this.activeRecurlySubscription.account.account_code

        this.User.findById = (userId, projection, callback) => {
          userId.should.equal(this.user.id)
          callback(null, this.user)
        }
        this.SubscriptionHandler.syncSubscription(
          this.activeRecurlySubscription,
          {},
          done
        )
      })

      it('should request the affected subscription from the API', function () {
        this.RecurlyWrapper.getSubscription
          .calledWith(this.activeRecurlySubscription.uuid)
          .should.equal(true)
      })

      it('should request the account details of the subscription', function () {
        const options = this.RecurlyWrapper.getSubscription.args[0][1]
        options.includeAccount.should.equal(true)
      })

      it('should sync the subscription to the user', function () {
        this.SubscriptionUpdater.syncSubscription.calledOnce.should.equal(true)
        this.SubscriptionUpdater.syncSubscription.args[0][0].should.deep.equal(
          this.activeRecurlySubscription
        )
        this.SubscriptionUpdater.syncSubscription.args[0][1].should.deep.equal(
          this.user._id
        )
      })
    })
  })

  describe('attemptPaypalInvoiceCollection', function () {
    describe('for credit card users', function () {
      beforeEach(function (done) {
        this.RecurlyWrapper.getBillingInfo.yields(null, {
          paypal_billing_agreement_id: null,
        })
        this.SubscriptionHandler.attemptPaypalInvoiceCollection(
          this.activeRecurlySubscription.account.account_code,
          done
        )
      })

      it('gets billing infos', function () {
        sinon.assert.calledWith(
          this.RecurlyWrapper.getBillingInfo,
          this.activeRecurlySubscription.account.account_code
        )
      })

      it('skips user', function () {
        sinon.assert.notCalled(this.RecurlyWrapper.getAccountPastDueInvoices)
      })
    })

    describe('for paypal users', function () {
      beforeEach(function (done) {
        this.RecurlyWrapper.getBillingInfo.yields(null, {
          paypal_billing_agreement_id: 'mock-billing-agreement',
        })
        this.RecurlyWrapper.getAccountPastDueInvoices.yields(null, [
          { invoice_number: 'mock-invoice-number' },
        ])
        this.SubscriptionHandler.attemptPaypalInvoiceCollection(
          this.activeRecurlySubscription.account.account_code,
          done
        )
      })

      it('gets past due invoices', function () {
        sinon.assert.calledWith(
          this.RecurlyWrapper.getAccountPastDueInvoices,
          this.activeRecurlySubscription.account.account_code
        )
      })

      it('calls attemptInvoiceCollection', function () {
        sinon.assert.calledWith(
          this.RecurlyWrapper.attemptInvoiceCollection,
          'mock-invoice-number'
        )
      })
    })
  })

  describe('validateNoSubscriptionInRecurly', function () {
    describe('with a subscription in recurly', function () {
      beforeEach(function () {
        this.RecurlyWrapper.listAccountActiveSubscriptions.yields(null, [
          this.subscription,
        ])
        this.SubscriptionHandler.validateNoSubscriptionInRecurly(
          this.user_id,
          this.callback
        )
      })

      it('should call RecurlyWrapper.listAccountActiveSubscriptions with the user id', function () {
        this.RecurlyWrapper.listAccountActiveSubscriptions
          .calledWith(this.user_id)
          .should.equal(true)
      })

      it('should sync the subscription', function () {
        this.SubscriptionUpdater.syncSubscription
          .calledWith(this.subscription, this.user_id)
          .should.equal(true)
      })

      it('should call the callback with valid == false', function () {
        this.callback.calledWith(null, false).should.equal(true)
      })
    })

    describe('with no subscription in recurly', function () {
      beforeEach(function () {
        this.SubscriptionHandler.validateNoSubscriptionInRecurly(
          this.user_id,
          this.callback
        )
      })

      it('should not sync the subscription', function () {
        this.SubscriptionUpdater.syncSubscription.called.should.equal(false)
      })

      it('should call the callback with valid == true', function () {
        this.callback.calledWith(null, true).should.equal(true)
      })
    })
  })
})
