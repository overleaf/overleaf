/* eslint-disable
    max-len,
    no-return-assign,
    no-unused-vars,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const SandboxedModule = require('sandboxed-module')
const should = require('chai').should()
const sinon = require('sinon')
const querystring = require('querystring')
const modulePath =
  '../../../../app/src/Features/Subscription/SubscriptionHandler'

const mockRecurlySubscriptions = {
  'subscription-123-active': {
    uuid: 'subscription-123-active',
    plan: {
      name: 'Gold',
      plan_code: 'gold'
    },
    current_period_ends_at: new Date(),
    state: 'active',
    unit_amount_in_cents: 999,
    account: {
      account_code: 'user-123'
    }
  }
}

describe('SubscriptionHandler', function() {
  beforeEach(function() {
    this.Settings = {
      plans: [
        {
          planCode: 'collaborator',
          name: 'Collaborator',
          features: {
            collaborators: -1,
            versioning: true
          }
        }
      ],
      defaultPlanCode: {
        collaborators: 0,
        versioning: false
      }
    }
    this.activeRecurlySubscription =
      mockRecurlySubscriptions['subscription-123-active']
    this.User = {}
    this.user = { _id: (this.user_id = 'user_id_here_') }
    this.subscription = {
      recurlySubscription_id: this.activeRecurlySubscription.uuid
    }
    this.RecurlyWrapper = {
      getSubscription: sinon
        .stub()
        .callsArgWith(2, null, this.activeRecurlySubscription),
      updateSubscription: sinon
        .stub()
        .callsArgWith(2, null, this.activeRecurlySubscription),
      cancelSubscription: sinon.stub().callsArgWith(1),
      reactivateSubscription: sinon.stub().callsArgWith(1),
      redeemCoupon: sinon.stub().callsArgWith(2),
      createSubscription: sinon
        .stub()
        .callsArgWith(3, null, this.activeRecurlySubscription)
    }

    this.DropboxHandler = { unlinkAccount: sinon.stub().callsArgWith(1) }

    this.SubscriptionUpdater = {
      syncSubscription: sinon.stub().yields(),
      startFreeTrial: sinon.stub().callsArgWith(1)
    }

    this.LimitationsManager = { userHasV2Subscription: sinon.stub() }

    this.EmailHandler = { sendEmail: sinon.stub() }

    this.AnalyticsManager = { recordEvent: sinon.stub() }

    this.SubscriptionHandler = SandboxedModule.require(modulePath, {
      globals: {
        console: console
      },
      requires: {
        './RecurlyWrapper': this.RecurlyWrapper,
        'settings-sharelatex': this.Settings,
        '../../models/User': {
          User: this.User
        },
        './SubscriptionUpdater': this.SubscriptionUpdater,
        'logger-sharelatex': { log() {} },
        './LimitationsManager': this.LimitationsManager,
        '../Email/EmailHandler': this.EmailHandler,
        '../Dropbox/DropboxHandler': this.DropboxHandler,
        '../../infrastructure/Events': (this.Events = { emit: sinon.stub() }),
        '../Analytics/AnalyticsManager': this.AnalyticsManager
      }
    })

    return (this.SubscriptionHandler.syncSubscriptionToUser = sinon
      .stub()
      .callsArgWith(2))
  })

  describe('createSubscription', function() {
    beforeEach(function() {
      this.callback = sinon.stub()
      this.subscriptionDetails = {
        cvv: '123',
        number: '12345'
      }
      this.recurlyTokenIds = { billing: '45555666' }
      return (this.SubscriptionHandler.validateNoSubscriptionInRecurly = sinon
        .stub()
        .yields(null, true))
    })

    describe('successfully', function() {
      beforeEach(function() {
        return this.SubscriptionHandler.createSubscription(
          this.user,
          this.subscriptionDetails,
          this.recurlyTokenIds,
          this.callback
        )
      })

      it('should create the subscription with the wrapper', function() {
        return this.RecurlyWrapper.createSubscription
          .calledWith(this.user, this.subscriptionDetails, this.recurlyTokenIds)
          .should.equal(true)
      })

      it('should sync the subscription to the user', function() {
        this.SubscriptionUpdater.syncSubscription.calledOnce.should.equal(true)
        this.SubscriptionUpdater.syncSubscription.args[0][0].should.deep.equal(
          this.activeRecurlySubscription
        )
        return this.SubscriptionUpdater.syncSubscription.args[0][1].should.deep.equal(
          this.user._id
        )
      })
    })

    describe('when there is already a subscription in Recurly', function() {
      beforeEach(function() {
        this.SubscriptionHandler.validateNoSubscriptionInRecurly = sinon
          .stub()
          .yields(null, false)
        return this.SubscriptionHandler.createSubscription(
          this.user,
          this.subscriptionDetails,
          this.recurlyTokenIds,
          this.callback
        )
      })

      it('should return an error', function() {
        return this.callback.calledWith(
          new Error('user already has subscription in recurly')
        )
      })
    })
  })

  describe('updateSubscription', function() {
    describe('with a user with a subscription', function() {
      describe('with a valid plan code', function() {
        beforeEach(function(done) {
          this.plan_code = 'collaborator'
          this.LimitationsManager.userHasV2Subscription.callsArgWith(
            1,
            null,
            true,
            this.subscription
          )
          return this.SubscriptionHandler.updateSubscription(
            this.user,
            this.plan_code,
            null,
            done
          )
        })

        it('should update the subscription', function() {
          this.RecurlyWrapper.updateSubscription
            .calledWith(this.subscription.recurlySubscription_id)
            .should.equal(true)
          const updateOptions = this.RecurlyWrapper.updateSubscription
            .args[0][1]
          return updateOptions.plan_code.should.equal(this.plan_code)
        })

        it('should update immediately', function() {
          const updateOptions = this.RecurlyWrapper.updateSubscription
            .args[0][1]
          return updateOptions.timeframe.should.equal('now')
        })

        it('should sync the new subscription to the user', function() {
          this.SubscriptionUpdater.syncSubscription.calledOnce.should.equal(
            true
          )
          this.SubscriptionUpdater.syncSubscription.args[0][0].should.deep.equal(
            this.activeRecurlySubscription
          )
          return this.SubscriptionUpdater.syncSubscription.args[0][1].should.deep.equal(
            this.user._id
          )
        })
      })
    })

    describe('with a user without a subscription', function() {
      beforeEach(function(done) {
        this.LimitationsManager.userHasV2Subscription.callsArgWith(
          1,
          null,
          false
        )
        return this.SubscriptionHandler.updateSubscription(
          this.user,
          this.plan_code,
          null,
          done
        )
      })

      it('should redirect to the subscription dashboard', function() {
        this.RecurlyWrapper.updateSubscription.called.should.equal(false)
        return this.SubscriptionHandler.syncSubscriptionToUser.called.should.equal(
          false
        )
      })
    })

    describe('with a coupon code', function() {
      beforeEach(function(done) {
        this.plan_code = 'collaborator'
        this.coupon_code = '1231312'
        this.LimitationsManager.userHasV2Subscription.callsArgWith(
          1,
          null,
          true,
          this.subscription
        )
        return this.SubscriptionHandler.updateSubscription(
          this.user,
          this.plan_code,
          this.coupon_code,
          done
        )
      })

      it('should get the users account', function() {
        return this.RecurlyWrapper.getSubscription
          .calledWith(this.activeRecurlySubscription.uuid)
          .should.equal(true)
      })

      it('should redeme the coupon', function(done) {
        this.RecurlyWrapper.redeemCoupon
          .calledWith(
            this.activeRecurlySubscription.account.account_code,
            this.coupon_code
          )
          .should.equal(true)
        return done()
      })

      it('should update the subscription', function() {
        this.RecurlyWrapper.updateSubscription
          .calledWith(this.subscription.recurlySubscription_id)
          .should.equal(true)
        const updateOptions = this.RecurlyWrapper.updateSubscription.args[0][1]
        return updateOptions.plan_code.should.equal(this.plan_code)
      })
    })
  })

  describe('cancelSubscription', function() {
    describe('with a user without a subscription', function() {
      beforeEach(function(done) {
        this.LimitationsManager.userHasV2Subscription.callsArgWith(
          1,
          null,
          false,
          this.subscription
        )
        return this.SubscriptionHandler.cancelSubscription(this.user, done)
      })

      it('should redirect to the subscription dashboard', function() {
        return this.RecurlyWrapper.cancelSubscription.called.should.equal(false)
      })
    })

    describe('with a user with a subscription', function() {
      beforeEach(function(done) {
        this.LimitationsManager.userHasV2Subscription.callsArgWith(
          1,
          null,
          true,
          this.subscription
        )
        return this.SubscriptionHandler.cancelSubscription(this.user, done)
      })

      it('should cancel the subscription', function() {
        this.RecurlyWrapper.cancelSubscription.called.should.equal(true)
        return this.RecurlyWrapper.cancelSubscription
          .calledWith(this.subscription.recurlySubscription_id)
          .should.equal(true)
      })

      it('should trigger the cancel subscription event', function() {
        return this.Events.emit
          .calledWith('cancelSubscription', this.user._id)
          .should.equal(true)
      })
    })
  })

  describe('reactiveRecurlySubscription', function() {
    describe('with a user without a subscription', function() {
      beforeEach(function(done) {
        this.LimitationsManager.userHasV2Subscription.callsArgWith(
          1,
          null,
          false,
          this.subscription
        )
        return this.SubscriptionHandler.reactivateSubscription(this.user, done)
      })

      it('should redirect to the subscription dashboard', function() {
        return this.RecurlyWrapper.reactivateSubscription.called.should.equal(
          false
        )
      })

      it('should not send a notification email', function() {
        return sinon.assert.notCalled(this.EmailHandler.sendEmail)
      })
    })

    describe('with a user with a subscription', function() {
      beforeEach(function(done) {
        this.LimitationsManager.userHasV2Subscription.callsArgWith(
          1,
          null,
          true,
          this.subscription
        )
        return this.SubscriptionHandler.reactivateSubscription(this.user, done)
      })

      it('should reactivate the subscription', function() {
        this.RecurlyWrapper.reactivateSubscription.called.should.equal(true)
        return this.RecurlyWrapper.reactivateSubscription
          .calledWith(this.subscription.recurlySubscription_id)
          .should.equal(true)
      })

      it('should send a notification email', function() {
        return sinon.assert.calledWith(
          this.EmailHandler.sendEmail,
          'reactivatedSubscription'
        )
      })
    })
  })

  describe('recurlyCallback', function() {
    describe('with an actionable request', function() {
      beforeEach(function(done) {
        this.user.id = this.activeRecurlySubscription.account.account_code

        this.User.findById = (userId, callback) => {
          userId.should.equal(this.user.id)
          return callback(null, this.user)
        }
        return this.SubscriptionHandler.recurlyCallback(
          this.activeRecurlySubscription,
          {},
          done
        )
      })

      it('should request the affected subscription from the API', function() {
        return this.RecurlyWrapper.getSubscription
          .calledWith(this.activeRecurlySubscription.uuid)
          .should.equal(true)
      })

      it('should request the account details of the subscription', function() {
        const options = this.RecurlyWrapper.getSubscription.args[0][1]
        return options.includeAccount.should.equal(true)
      })

      it('should sync the subscription to the user', function() {
        this.SubscriptionUpdater.syncSubscription.calledOnce.should.equal(true)
        this.SubscriptionUpdater.syncSubscription.args[0][0].should.deep.equal(
          this.activeRecurlySubscription
        )
        return this.SubscriptionUpdater.syncSubscription.args[0][1].should.deep.equal(
          this.user._id
        )
      })
    })
  })

  describe('validateNoSubscriptionInRecurly', function() {
    beforeEach(function() {
      this.subscriptions = []
      this.RecurlyWrapper.listAccountActiveSubscriptions = sinon
        .stub()
        .yields(null, this.subscriptions)
      this.SubscriptionUpdater.syncSubscription = sinon.stub().yields()
      return (this.callback = sinon.stub())
    })

    describe('with no subscription in recurly', function() {
      beforeEach(function() {
        this.subscriptions.push((this.subscription = { mock: 'subscription' }))
        return this.SubscriptionHandler.validateNoSubscriptionInRecurly(
          this.user_id,
          this.callback
        )
      })

      it('should call RecurlyWrapper.listAccountActiveSubscriptions with the user id', function() {
        return this.RecurlyWrapper.listAccountActiveSubscriptions
          .calledWith(this.user_id)
          .should.equal(true)
      })

      it('should sync the subscription', function() {
        return this.SubscriptionUpdater.syncSubscription
          .calledWith(this.subscription, this.user_id)
          .should.equal(true)
      })

      it('should call the callback with valid == false', function() {
        return this.callback.calledWith(null, false).should.equal(true)
      })
    })

    describe('with a subscription in recurly', function() {
      beforeEach(function() {
        return this.SubscriptionHandler.validateNoSubscriptionInRecurly(
          this.user_id,
          this.callback
        )
      })

      it('should not sync the subscription', function() {
        return this.SubscriptionUpdater.syncSubscription.called.should.equal(
          false
        )
      })

      it('should call the callback with valid == true', function() {
        return this.callback.calledWith(null, true).should.equal(true)
      })
    })
  })
})
