// @ts-check

const SandboxedModule = require('sandboxed-module')
const { expect } = require('chai')
const Errors = require('../../../../app/src/Features/Subscription/Errors')
const {
  PaymentProviderSubscriptionChangeRequest,
  PaymentProviderSubscriptionUpdateRequest,
  PaymentProviderSubscriptionChange,
  PaymentProviderSubscription,
  PaymentProviderSubscriptionAddOnUpdate,
} = require('../../../../app/src/Features/Subscription/PaymentProviderEntities')
const {
  AI_ADD_ON_CODE,
} = require('../../../../app/src/Features/Subscription/AiHelper')
const SubscriptionHelper = require('../../../../app/src/Features/Subscription/SubscriptionHelper')

const MODULE_PATH =
  '../../../../app/src/Features/Subscription/PaymentProviderEntities'

describe('PaymentProviderEntities', function () {
  describe('PaymentProviderSubscription', function () {
    beforeEach(function () {
      this.Settings = {
        plans: [
          { planCode: 'assistant-annual', price_in_cents: 5900 },
          { planCode: 'cheap-plan', price_in_cents: 500 },
          { planCode: 'regular-plan', price_in_cents: 1000 },
          { planCode: 'premium-plan', price_in_cents: 2000 },
          {
            planCode: 'group_collaborator_10_enterprise',
            price_in_cents: 10000,
          },
        ],
        features: [],
      }

      this.PaymentProviderEntities = SandboxedModule.require(MODULE_PATH, {
        requires: {
          '@overleaf/settings': this.Settings,
          './Errors': Errors,
          './SubscriptionHelper': SubscriptionHelper,
        },
      })
    })

    describe('with add-ons', function () {
      beforeEach(function () {
        const {
          PaymentProviderSubscription,
          PaymentProviderSubscriptionAddOn,
        } = this.PaymentProviderEntities
        this.addOn = new PaymentProviderSubscriptionAddOn({
          code: 'add-on-code',
          name: 'My Add-On',
          quantity: 1,
          unitPrice: 2,
        })
        this.subscription = new PaymentProviderSubscription({
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
          const { PaymentProviderSubscriptionChangeRequest } =
            this.PaymentProviderEntities
          const changeRequest = this.subscription.getRequestForPlanChange(
            'premium-plan',
            1,
            this.subscription.shouldPlanChangeAtTermEnd('premium-plan')
          )
          expect(changeRequest).to.deep.equal(
            new PaymentProviderSubscriptionChangeRequest({
              subscription: this.subscription,
              timeframe: 'now',
              planCode: 'premium-plan',
            })
          )
        })

        it('returns a change request for downgrades', function () {
          const { PaymentProviderSubscriptionChangeRequest } =
            this.PaymentProviderEntities
          const changeRequest = this.subscription.getRequestForPlanChange(
            'cheap-plan',
            1,
            this.subscription.shouldPlanChangeAtTermEnd('cheap-plan')
          )
          expect(changeRequest).to.deep.equal(
            new PaymentProviderSubscriptionChangeRequest({
              subscription: this.subscription,
              timeframe: 'term_end',
              planCode: 'cheap-plan',
            })
          )
        })

        it('returns a change request for downgrades while on trial', function () {
          const fiveDaysFromNow = new Date()
          fiveDaysFromNow.setDate(fiveDaysFromNow.getDate() + 5)
          this.subscription.trialPeriodEnd = fiveDaysFromNow
          const { PaymentProviderSubscriptionChangeRequest } =
            this.PaymentProviderEntities
          const changeRequest = this.subscription.getRequestForPlanChange(
            'cheap-plan',
            1,
            this.subscription.shouldPlanChangeAtTermEnd('cheap-plan')
          )
          expect(changeRequest).to.deep.equal(
            new PaymentProviderSubscriptionChangeRequest({
              subscription: this.subscription,
              timeframe: 'now',
              planCode: 'cheap-plan',
            })
          )
        })

        it('preserves the AI add-on on upgrades', function () {
          const { PaymentProviderSubscriptionChangeRequest } =
            this.PaymentProviderEntities
          this.addOn.code = AI_ADD_ON_CODE
          const changeRequest = this.subscription.getRequestForPlanChange(
            'premium-plan',
            1,
            this.subscription.shouldPlanChangeAtTermEnd('premium-plan')
          )
          expect(changeRequest).to.deep.equal(
            new PaymentProviderSubscriptionChangeRequest({
              subscription: this.subscription,
              timeframe: 'now',
              planCode: 'premium-plan',
              addOnUpdates: [
                new PaymentProviderSubscriptionAddOnUpdate({
                  code: AI_ADD_ON_CODE,
                  quantity: 1,
                }),
              ],
            })
          )
        })

        it('preserves the AI add-on on downgrades', function () {
          const { PaymentProviderSubscriptionChangeRequest } =
            this.PaymentProviderEntities
          this.addOn.code = AI_ADD_ON_CODE
          const changeRequest = this.subscription.getRequestForPlanChange(
            'cheap-plan',
            1,
            this.subscription.shouldPlanChangeAtTermEnd('cheap-plan')
          )
          expect(changeRequest).to.deep.equal(
            new PaymentProviderSubscriptionChangeRequest({
              subscription: this.subscription,
              timeframe: 'term_end',
              planCode: 'cheap-plan',
              addOnUpdates: [
                new PaymentProviderSubscriptionAddOnUpdate({
                  code: AI_ADD_ON_CODE,
                  quantity: 1,
                }),
              ],
            })
          )
        })

        it('preserves the AI add-on on upgrades from the standalone AI plan', function () {
          const { PaymentProviderSubscriptionChangeRequest } =
            this.PaymentProviderEntities
          this.subscription.planCode = 'assistant-annual'
          this.subscription.addOns = []
          const changeRequest = this.subscription.getRequestForPlanChange(
            'cheap-plan',
            1,
            this.subscription.shouldPlanChangeAtTermEnd('cheap-plan')
          )
          expect(changeRequest).to.deep.equal(
            new PaymentProviderSubscriptionChangeRequest({
              subscription: this.subscription,
              timeframe: 'now',
              planCode: 'cheap-plan',
              addOnUpdates: [
                new PaymentProviderSubscriptionAddOnUpdate({
                  code: AI_ADD_ON_CODE,
                  quantity: 1,
                }),
              ],
            })
          )
        })

        it('upgrade from individual to group plan for Stripe subscription', function () {
          this.subscription.service = 'stripe-uk'
          const { PaymentProviderSubscriptionChangeRequest } =
            this.PaymentProviderEntities
          const changeRequest = this.subscription.getRequestForPlanChange(
            'group_collaborator',
            10,
            this.subscription.shouldPlanChangeAtTermEnd(
              'group_collaborator_10_enterprise'
            )
          )
          expect(changeRequest).to.deep.equal(
            new PaymentProviderSubscriptionChangeRequest({
              subscription: this.subscription,
              timeframe: 'now',
              planCode: 'group_collaborator',
              addOnUpdates: [
                new PaymentProviderSubscriptionAddOnUpdate({
                  code: 'additional-license',
                  quantity: 10,
                }),
              ],
            })
          )
        })

        it('upgrade from individual to group plan and preserves the AI add-on for Stripe subscription', function () {
          this.subscription.service = 'stripe-uk'
          const { PaymentProviderSubscriptionChangeRequest } =
            this.PaymentProviderEntities
          this.addOn.code = AI_ADD_ON_CODE
          const changeRequest = this.subscription.getRequestForPlanChange(
            'group_collaborator',
            10,
            this.subscription.shouldPlanChangeAtTermEnd(
              'group_collaborator_10_enterprise'
            )
          )
          expect(changeRequest).to.deep.equal(
            new PaymentProviderSubscriptionChangeRequest({
              subscription: this.subscription,
              timeframe: 'now',
              planCode: 'group_collaborator',
              addOnUpdates: [
                new PaymentProviderSubscriptionAddOnUpdate({
                  code: 'additional-license',
                  quantity: 10,
                }),
                new PaymentProviderSubscriptionAddOnUpdate({
                  code: AI_ADD_ON_CODE,
                  quantity: 1,
                }),
              ],
            })
          )
        })
      })

      describe('getRequestForAddOnPurchase()', function () {
        it('returns a change request', function () {
          const {
            PaymentProviderSubscriptionChangeRequest,
            PaymentProviderSubscriptionAddOnUpdate,
          } = this.PaymentProviderEntities
          const changeRequest =
            this.subscription.getRequestForAddOnPurchase('another-add-on')
          expect(changeRequest).to.deep.equal(
            new PaymentProviderSubscriptionChangeRequest({
              subscription: this.subscription,
              timeframe: 'now',
              addOnUpdates: [
                new PaymentProviderSubscriptionAddOnUpdate({
                  code: this.addOn.code,
                  quantity: this.addOn.quantity,
                  unitPrice: this.addOn.unitPrice,
                }),
                new PaymentProviderSubscriptionAddOnUpdate({
                  code: 'another-add-on',
                  quantity: 1,
                }),
              ],
            })
          )
        })

        it('returns a change request with quantity and unit price specified', function () {
          const {
            PaymentProviderSubscriptionChangeRequest,
            PaymentProviderSubscriptionAddOnUpdate,
          } = this.PaymentProviderEntities
          const quantity = 5
          const unitPrice = 10
          const changeRequest = this.subscription.getRequestForAddOnPurchase(
            'another-add-on',
            quantity,
            unitPrice
          )
          expect(changeRequest).to.deep.equal(
            new PaymentProviderSubscriptionChangeRequest({
              subscription: this.subscription,
              timeframe: 'now',
              addOnUpdates: [
                new PaymentProviderSubscriptionAddOnUpdate({
                  code: this.addOn.code,
                  quantity: this.addOn.quantity,
                  unitPrice: this.addOn.unitPrice,
                }),
                new PaymentProviderSubscriptionAddOnUpdate({
                  code: 'another-add-on',
                  quantity,
                  unitPrice,
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

      describe('getRequestForAddOnUpdate()', function () {
        it('returns a change request', function () {
          const {
            PaymentProviderSubscriptionChangeRequest,
            PaymentProviderSubscriptionAddOnUpdate,
          } = this.PaymentProviderEntities
          const newQuantity = 2
          const changeRequest = this.subscription.getRequestForAddOnUpdate(
            'add-on-code',
            newQuantity
          )
          expect(changeRequest).to.deep.equal(
            new PaymentProviderSubscriptionChangeRequest({
              subscription: this.subscription,
              timeframe: 'now',
              addOnUpdates: [
                new PaymentProviderSubscriptionAddOnUpdate({
                  code: this.addOn.code,
                  quantity: newQuantity,
                  unitPrice: this.addOn.unitPrice,
                }),
              ],
            })
          )
        })

        it("throws a AddOnNotPresentError if the subscription doesn't have the add-on", function () {
          expect(() =>
            this.subscription.getRequestForAddOnUpdate('another-add-on', 2)
          ).to.throw(Errors.AddOnNotPresentError)
        })
      })

      describe('getRequestForAddOnRemoval()', function () {
        it('returns a change request', function () {
          const changeRequest = this.subscription.getRequestForAddOnRemoval(
            this.addOn.code
          )
          expect(changeRequest).to.deep.equal(
            new PaymentProviderSubscriptionChangeRequest({
              subscription: this.subscription,
              timeframe: 'term_end',
              addOnUpdates: [],
            })
          )
        })

        it('returns a change request when in trial', function () {
          const fiveDaysFromNow = new Date()
          fiveDaysFromNow.setDate(fiveDaysFromNow.getDate() + 5)
          this.subscription.trialPeriodEnd = fiveDaysFromNow
          const changeRequest = this.subscription.getRequestForAddOnRemoval(
            this.addOn.code
          )
          expect(changeRequest).to.deep.equal(
            new PaymentProviderSubscriptionChangeRequest({
              subscription: this.subscription,
              timeframe: 'now',
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

      describe('getRequestForGroupPlanUpgrade()', function () {
        it('returns a correct change request', function () {
          const changeRequest =
            this.subscription.getRequestForGroupPlanUpgrade('test_plan_code')
          const addOns = [
            new PaymentProviderSubscriptionAddOnUpdate({
              code: 'add-on-code',
              quantity: 1,
            }),
          ]
          expect(changeRequest).to.deep.equal(
            new PaymentProviderSubscriptionChangeRequest({
              subscription: this.subscription,
              timeframe: 'now',
              addOnUpdates: addOns,
              planCode: 'test_plan_code',
            })
          )
        })
      })

      describe('getRequestForPoNumberAndTermsAndConditionsUpdate()', function () {
        it('returns a correct update request', function () {
          const updateRequest =
            this.subscription.getRequestForPoNumberAndTermsAndConditionsUpdate(
              'O12345',
              'T&C copy'
            )
          expect(updateRequest).to.deep.equal(
            new PaymentProviderSubscriptionUpdateRequest({
              subscription: this.subscription,
              poNumber: 'O12345',
              termsAndConditions: 'T&C copy',
            })
          )
        })
      })

      describe('getRequestForTermsAndConditionsUpdate()', function () {
        it('returns a correct update request', function () {
          const updateRequest =
            this.subscription.getRequestForTermsAndConditionsUpdate('T&C copy')
          expect(updateRequest).to.deep.equal(
            new PaymentProviderSubscriptionUpdateRequest({
              subscription: this.subscription,
              termsAndConditions: 'T&C copy',
            })
          )
        })
      })

      describe('without add-ons', function () {
        beforeEach(function () {
          const { PaymentProviderSubscription } = this.PaymentProviderEntities
          this.subscription = new PaymentProviderSubscription({
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
              PaymentProviderSubscriptionChangeRequest,
              PaymentProviderSubscriptionAddOnUpdate,
            } = this.PaymentProviderEntities
            const changeRequest =
              this.subscription.getRequestForAddOnPurchase('some-add-on')
            expect(changeRequest).to.deep.equal(
              new PaymentProviderSubscriptionChangeRequest({
                subscription: this.subscription,
                timeframe: 'now',
                addOnUpdates: [
                  new PaymentProviderSubscriptionAddOnUpdate({
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

  describe('PaymentProviderSubscriptionChange', function () {
    describe('constructor', function () {
      it('rounds the amounts when calculating the taxes', function () {
        const subscription = new PaymentProviderSubscription({
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
          collectionMethod: 'automatic',
          netTerms: 0,
          poNumber: '012345',
          termsAndConditions: 'T&C copy',
        })
        const change = new PaymentProviderSubscriptionChange({
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
