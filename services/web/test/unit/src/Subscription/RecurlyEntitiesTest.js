// @ts-check

const SandboxedModule = require('sandboxed-module')
const { expect } = require('chai')
const Errors = require('../../../../app/src/Features/Subscription/Errors')
const {
  RecurlySubscriptionChangeRequest,
  RecurlySubscriptionChange,
  RecurlySubscription,
} = require('../../../../app/src/Features/Subscription/RecurlyEntities')

const MODULE_PATH = '../../../../app/src/Features/Subscription/RecurlyEntities'

describe('RecurlyEntities', function () {
  describe('RecurlySubscription', function () {
    beforeEach(function () {
      this.Settings = {
        plans: [
          { planCode: 'cheap-plan', price_in_cents: 500 },
          { planCode: 'regular-plan', price_in_cents: 1000 },
          { planCode: 'premium-plan', price_in_cents: 2000 },
        ],
        features: [],
      }

      this.RecurlyEntities = SandboxedModule.require(MODULE_PATH, {
        requires: {
          '@overleaf/settings': this.Settings,
          './Errors': Errors,
        },
      })
    })

    describe('with add-ons', function () {
      beforeEach(function () {
        const { RecurlySubscription, RecurlySubscriptionAddOn } =
          this.RecurlyEntities
        this.addOn = new RecurlySubscriptionAddOn({
          code: 'add-on-code',
          name: 'My Add-On',
          quantity: 1,
          unitPrice: 2,
        })
        this.subscription = new RecurlySubscription({
          id: 'subscription-id',
          userId: 'user-id',
          planCode: 'regular-plan',
          planName: 'My Plan',
          planPrice: 10,
          addOns: [this.addOn],
          subtotal: 10.99,
          taxRate: 0.2,
          taxAmount: 2.4,
          total: 14.4,
          currency: 'USD',
        })
      })

      describe('hasAddOn()', function () {
        it('returns true if the subscription has the given add-on', function () {
          expect(this.subscription.hasAddOn(this.addOn.code)).to.be.true
        })

        it("returns false if the subscription doesn't have the given add-on", function () {
          expect(this.subscription.hasAddOn('another-add-on')).to.be.false
        })
      })

      describe('getRequestForPlanChange()', function () {
        it('returns a change request for upgrades', function () {
          const { RecurlySubscriptionChangeRequest } = this.RecurlyEntities
          const changeRequest =
            this.subscription.getRequestForPlanChange('premium-plan')
          expect(changeRequest).to.deep.equal(
            new RecurlySubscriptionChangeRequest({
              subscription: this.subscription,
              timeframe: 'now',
              planCode: 'premium-plan',
            })
          )
        })

        it('returns a change request for downgrades', function () {
          const { RecurlySubscriptionChangeRequest } = this.RecurlyEntities
          const changeRequest =
            this.subscription.getRequestForPlanChange('cheap-plan')
          expect(changeRequest).to.deep.equal(
            new RecurlySubscriptionChangeRequest({
              subscription: this.subscription,
              timeframe: 'term_end',
              planCode: 'cheap-plan',
            })
          )
        })
      })

      describe('getRequestForAddOnPurchase()', function () {
        it('returns a change request', function () {
          const {
            RecurlySubscriptionChangeRequest,
            RecurlySubscriptionAddOnUpdate,
          } = this.RecurlyEntities
          const changeRequest =
            this.subscription.getRequestForAddOnPurchase('another-add-on')
          expect(changeRequest).to.deep.equal(
            new RecurlySubscriptionChangeRequest({
              subscription: this.subscription,
              timeframe: 'now',
              addOnUpdates: [
                new RecurlySubscriptionAddOnUpdate({
                  code: this.addOn.code,
                  quantity: this.addOn.quantity,
                  unitPrice: this.addOn.unitPrice,
                }),
                new RecurlySubscriptionAddOnUpdate({
                  code: 'another-add-on',
                  quantity: 1,
                }),
              ],
            })
          )
        })

        it('throws a DuplicateAddOnError if the subscription already has the add-on', function () {
          expect(() =>
            this.subscription.getRequestForAddOnPurchase(this.addOn.code)
          ).to.throw(Errors.DuplicateAddOnError)
        })
      })

      describe('getRequestForAddOnRemoval()', function () {
        it('returns a change request', function () {
          const changeRequest = this.subscription.getRequestForAddOnRemoval(
            this.addOn.code
          )
          expect(changeRequest).to.deep.equal(
            new RecurlySubscriptionChangeRequest({
              subscription: this.subscription,
              timeframe: 'term_end',
              addOnUpdates: [],
            })
          )
        })

        it("throws an AddOnNotPresentError if the subscription doesn't have the add-on", function () {
          expect(() =>
            this.subscription.getRequestForAddOnRemoval('another-add-on')
          ).to.throw(Errors.AddOnNotPresentError)
        })
      })

      describe('without add-ons', function () {
        beforeEach(function () {
          const { RecurlySubscription } = this.RecurlyEntities
          this.subscription = new RecurlySubscription({
            id: 'subscription-id',
            userId: 'user-id',
            planCode: 'regular-plan',
            planName: 'My Plan',
            planPrice: 10,
            subtotal: 10.99,
            taxRate: 0.2,
            taxAmount: 2.4,
            total: 14.4,
            currency: 'USD',
          })
        })

        describe('hasAddOn()', function () {
          it('returns false for any add-on', function () {
            expect(this.subscription.hasAddOn('some-add-on')).to.be.false
          })
        })

        describe('getRequestForAddOnPurchase()', function () {
          it('returns a change request', function () {
            const {
              RecurlySubscriptionChangeRequest,
              RecurlySubscriptionAddOnUpdate,
            } = this.RecurlyEntities
            const changeRequest =
              this.subscription.getRequestForAddOnPurchase('some-add-on')
            expect(changeRequest).to.deep.equal(
              new RecurlySubscriptionChangeRequest({
                subscription: this.subscription,
                timeframe: 'now',
                addOnUpdates: [
                  new RecurlySubscriptionAddOnUpdate({
                    code: 'some-add-on',
                    quantity: 1,
                  }),
                ],
              })
            )
          })
        })

        describe('getRequestForAddOnRemoval()', function () {
          it('throws an AddOnNotPresentError', function () {
            expect(() =>
              this.subscription.getRequestForAddOnRemoval('some-add-on')
            ).to.throw(Errors.AddOnNotPresentError)
          })
        })
      })
    })
  })

  describe('RecurlySubscriptionChange', function () {
    describe('constructor', function () {
      it('rounds the amounts when calculating the taxes', function () {
        const subscription = new RecurlySubscription({
          id: 'subscription-id',
          userId: 'user-id',
          planCode: 'premium-plan',
          planName: 'Premium plan',
          planPrice: 10,
          subtotal: 10,
          taxRate: 0.15,
          taxAmount: 1.5,
          currency: 'USD',
          total: 11.5,
          periodStart: new Date(),
          periodEnd: new Date(),
        })
        const change = new RecurlySubscriptionChange({
          subscription,
          nextPlanCode: 'promotional-plan',
          nextPlanName: 'Promotial plan',
          nextPlanPrice: 8.99,
          nextAddOns: [],
        })
        expect(change.tax).to.equal(1.35)
        expect(change.total).to.equal(10.34)
      })
    })
  })
})
