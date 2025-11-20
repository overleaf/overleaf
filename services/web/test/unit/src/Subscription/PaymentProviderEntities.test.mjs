import { vi, expect } from 'vitest'

import Errors from '../../../../app/src/Features/Subscription/Errors.mjs'

import PaymentProviderEntities from '../../../../app/src/Features/Subscription/PaymentProviderEntities.mjs'
import { AI_ADD_ON_CODE } from '../../../../app/src/Features/Subscription/AiHelper.mjs'
import SubscriptionHelper from '../../../../app/src/Features/Subscription/SubscriptionHelper.mjs'

const {
  PaymentProviderSubscriptionChangeRequest,
  PaymentProviderSubscriptionUpdateRequest,
  PaymentProviderSubscriptionChange,
  PaymentProviderSubscription,
  PaymentProviderSubscriptionAddOnUpdate,
} = PaymentProviderEntities

const MODULE_PATH =
  '../../../../app/src/Features/Subscription/PaymentProviderEntities'

describe('PaymentProviderEntities', function () {
  describe('PaymentProviderSubscription', function () {
    beforeEach(async function (ctx) {
      ctx.Settings = {
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

      vi.doMock('@overleaf/settings', () => ({
        default: ctx.Settings,
      }))

      vi.doMock(
        '../../../../app/src/Features/Subscription/Errors',
        () => Errors
      )

      vi.doMock(
        '../../../../app/src/Features/Subscription/SubscriptionHelper',
        () => ({
          default: SubscriptionHelper,
        })
      )

      ctx.PaymentProviderEntities = (await import(MODULE_PATH)).default
    })

    describe('with add-ons', function () {
      beforeEach(function (ctx) {
        const {
          PaymentProviderSubscription,
          PaymentProviderSubscriptionAddOn,
        } = ctx.PaymentProviderEntities
        ctx.addOn = new PaymentProviderSubscriptionAddOn({
          code: 'add-on-code',
          name: 'My Add-On',
          quantity: 1,
          unitPrice: 2,
        })
        ctx.subscription = new PaymentProviderSubscription({
          id: 'subscription-id',
          userId: 'user-id',
          planCode: 'regular-plan',
          planName: 'My Plan',
          planPrice: 10,
          addOns: [ctx.addOn],
          subtotal: 10.99,
          taxRate: 0.2,
          taxAmount: 2.4,
          total: 14.4,
          currency: 'USD',
        })
      })

      describe('hasAddOn()', function () {
        it('returns true if the subscription has the given add-on', function (ctx) {
          expect(ctx.subscription.hasAddOn(ctx.addOn.code)).to.be.true
        })

        it("returns false if the subscription doesn't have the given add-on", function (ctx) {
          expect(ctx.subscription.hasAddOn('another-add-on')).to.be.false
        })
      })

      describe('getRequestForPlanChange()', function () {
        it('returns a change request for upgrades', function (ctx) {
          const { PaymentProviderSubscriptionChangeRequest } =
            ctx.PaymentProviderEntities
          const changeRequest = ctx.subscription.getRequestForPlanChange(
            'premium-plan',
            1,
            ctx.subscription.shouldPlanChangeAtTermEnd('premium-plan')
          )
          expect(changeRequest).to.deep.equal(
            new PaymentProviderSubscriptionChangeRequest({
              subscription: ctx.subscription,
              timeframe: 'now',
              planCode: 'premium-plan',
            })
          )
        })

        it('returns a change request for downgrades', function (ctx) {
          const { PaymentProviderSubscriptionChangeRequest } =
            ctx.PaymentProviderEntities
          const changeRequest = ctx.subscription.getRequestForPlanChange(
            'cheap-plan',
            1,
            ctx.subscription.shouldPlanChangeAtTermEnd('cheap-plan')
          )
          expect(changeRequest).to.deep.equal(
            new PaymentProviderSubscriptionChangeRequest({
              subscription: ctx.subscription,
              timeframe: 'term_end',
              planCode: 'cheap-plan',
            })
          )
        })

        it('returns a change request for downgrades while on trial', function (ctx) {
          const fiveDaysFromNow = new Date()
          fiveDaysFromNow.setDate(fiveDaysFromNow.getDate() + 5)
          ctx.subscription.trialPeriodEnd = fiveDaysFromNow
          const { PaymentProviderSubscriptionChangeRequest } =
            ctx.PaymentProviderEntities
          const changeRequest = ctx.subscription.getRequestForPlanChange(
            'cheap-plan',
            1,
            ctx.subscription.shouldPlanChangeAtTermEnd('cheap-plan')
          )
          expect(changeRequest).to.deep.equal(
            new PaymentProviderSubscriptionChangeRequest({
              subscription: ctx.subscription,
              timeframe: 'now',
              planCode: 'cheap-plan',
            })
          )
        })

        it('preserves the AI add-on on upgrades', function (ctx) {
          const { PaymentProviderSubscriptionChangeRequest } =
            ctx.PaymentProviderEntities
          ctx.addOn.code = AI_ADD_ON_CODE
          const changeRequest = ctx.subscription.getRequestForPlanChange(
            'premium-plan',
            1,
            ctx.subscription.shouldPlanChangeAtTermEnd('premium-plan')
          )
          expect(changeRequest).to.deep.equal(
            new PaymentProviderSubscriptionChangeRequest({
              subscription: ctx.subscription,
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

        it('preserves the AI add-on on downgrades', function (ctx) {
          const { PaymentProviderSubscriptionChangeRequest } =
            ctx.PaymentProviderEntities
          ctx.addOn.code = AI_ADD_ON_CODE
          const changeRequest = ctx.subscription.getRequestForPlanChange(
            'cheap-plan',
            1,
            ctx.subscription.shouldPlanChangeAtTermEnd('cheap-plan')
          )
          expect(changeRequest).to.deep.equal(
            new PaymentProviderSubscriptionChangeRequest({
              subscription: ctx.subscription,
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

        it('preserves the AI add-on on upgrades from the standalone AI plan', function (ctx) {
          const { PaymentProviderSubscriptionChangeRequest } =
            ctx.PaymentProviderEntities
          ctx.subscription.planCode = 'assistant-annual'
          ctx.subscription.addOns = []
          const changeRequest = ctx.subscription.getRequestForPlanChange(
            'cheap-plan',
            1,
            ctx.subscription.shouldPlanChangeAtTermEnd('cheap-plan')
          )
          expect(changeRequest).to.deep.equal(
            new PaymentProviderSubscriptionChangeRequest({
              subscription: ctx.subscription,
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

        it('upgrade from individual to group plan for Stripe subscription', function (ctx) {
          ctx.subscription.service = 'stripe-uk'
          const { PaymentProviderSubscriptionChangeRequest } =
            ctx.PaymentProviderEntities
          const changeRequest = ctx.subscription.getRequestForPlanChange(
            'group_collaborator',
            10,
            ctx.subscription.shouldPlanChangeAtTermEnd(
              'group_collaborator_10_enterprise'
            )
          )
          expect(changeRequest).to.deep.equal(
            new PaymentProviderSubscriptionChangeRequest({
              subscription: ctx.subscription,
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

        it('upgrade from individual to group plan and preserves the AI add-on for Stripe subscription', function (ctx) {
          ctx.subscription.service = 'stripe-uk'
          const { PaymentProviderSubscriptionChangeRequest } =
            ctx.PaymentProviderEntities
          ctx.addOn.code = AI_ADD_ON_CODE
          const changeRequest = ctx.subscription.getRequestForPlanChange(
            'group_collaborator',
            10,
            ctx.subscription.shouldPlanChangeAtTermEnd(
              'group_collaborator_10_enterprise'
            )
          )
          expect(changeRequest).to.deep.equal(
            new PaymentProviderSubscriptionChangeRequest({
              subscription: ctx.subscription,
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
        it('returns a change request', function (ctx) {
          const {
            PaymentProviderSubscriptionChangeRequest,
            PaymentProviderSubscriptionAddOnUpdate,
          } = ctx.PaymentProviderEntities
          const changeRequest =
            ctx.subscription.getRequestForAddOnPurchase('another-add-on')
          expect(changeRequest).to.deep.equal(
            new PaymentProviderSubscriptionChangeRequest({
              subscription: ctx.subscription,
              timeframe: 'now',
              addOnUpdates: [
                new PaymentProviderSubscriptionAddOnUpdate({
                  code: ctx.addOn.code,
                  quantity: ctx.addOn.quantity,
                  unitPrice: ctx.addOn.unitPrice,
                }),
                new PaymentProviderSubscriptionAddOnUpdate({
                  code: 'another-add-on',
                  quantity: 1,
                }),
              ],
            })
          )
        })

        it('returns a change request with quantity and unit price specified', function (ctx) {
          const {
            PaymentProviderSubscriptionChangeRequest,
            PaymentProviderSubscriptionAddOnUpdate,
          } = ctx.PaymentProviderEntities
          const quantity = 5
          const unitPrice = 10
          const changeRequest = ctx.subscription.getRequestForAddOnPurchase(
            'another-add-on',
            quantity,
            unitPrice
          )
          expect(changeRequest).to.deep.equal(
            new PaymentProviderSubscriptionChangeRequest({
              subscription: ctx.subscription,
              timeframe: 'now',
              addOnUpdates: [
                new PaymentProviderSubscriptionAddOnUpdate({
                  code: ctx.addOn.code,
                  quantity: ctx.addOn.quantity,
                  unitPrice: ctx.addOn.unitPrice,
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

        it('throws a DuplicateAddOnError if the subscription already has the add-on', function (ctx) {
          expect(() =>
            ctx.subscription.getRequestForAddOnPurchase(ctx.addOn.code)
          ).to.throw(Errors.DuplicateAddOnError)
        })
      })

      describe('getRequestForAddOnUpdate()', function () {
        it('returns a change request', function (ctx) {
          const {
            PaymentProviderSubscriptionChangeRequest,
            PaymentProviderSubscriptionAddOnUpdate,
          } = ctx.PaymentProviderEntities
          const newQuantity = 2
          const changeRequest = ctx.subscription.getRequestForAddOnUpdate(
            'add-on-code',
            newQuantity
          )
          expect(changeRequest).to.deep.equal(
            new PaymentProviderSubscriptionChangeRequest({
              subscription: ctx.subscription,
              timeframe: 'now',
              addOnUpdates: [
                new PaymentProviderSubscriptionAddOnUpdate({
                  code: ctx.addOn.code,
                  quantity: newQuantity,
                  unitPrice: ctx.addOn.unitPrice,
                }),
              ],
            })
          )
        })

        it("throws a AddOnNotPresentError if the subscription doesn't have the add-on", function (ctx) {
          expect(() =>
            ctx.subscription.getRequestForAddOnUpdate('another-add-on', 2)
          ).to.throw(Errors.AddOnNotPresentError)
        })
      })

      describe('getRequestForAddOnRemoval()', function () {
        it('returns a change request', function (ctx) {
          const changeRequest = ctx.subscription.getRequestForAddOnRemoval(
            ctx.addOn.code
          )
          expect(changeRequest).to.deep.equal(
            new PaymentProviderSubscriptionChangeRequest({
              subscription: ctx.subscription,
              timeframe: 'term_end',
              addOnUpdates: [],
            })
          )
        })

        it('returns a change request when in trial', function (ctx) {
          const fiveDaysFromNow = new Date()
          fiveDaysFromNow.setDate(fiveDaysFromNow.getDate() + 5)
          ctx.subscription.trialPeriodEnd = fiveDaysFromNow
          const changeRequest = ctx.subscription.getRequestForAddOnRemoval(
            ctx.addOn.code
          )
          expect(changeRequest).to.deep.equal(
            new PaymentProviderSubscriptionChangeRequest({
              subscription: ctx.subscription,
              timeframe: 'now',
              addOnUpdates: [],
            })
          )
        })

        it("throws an AddOnNotPresentError if the subscription doesn't have the add-on", function (ctx) {
          expect(() =>
            ctx.subscription.getRequestForAddOnRemoval('another-add-on')
          ).to.throw(Errors.AddOnNotPresentError)
        })
      })

      describe('getRequestForAddOnReactivation()', function () {
        it('throws an AddOnNotPresentError', function (ctx) {
          expect(() =>
            ctx.subscription.getRequestForAddOnReactivation(ctx.addOn.code)
          ).to.throw(Errors.AddOnNotPresentError)
        })
      })

      describe('getRequestForGroupPlanUpgrade()', function () {
        it('returns a correct change request', function (ctx) {
          const changeRequest =
            ctx.subscription.getRequestForGroupPlanUpgrade('test_plan_code')
          const addOns = [
            new PaymentProviderSubscriptionAddOnUpdate({
              code: 'add-on-code',
              quantity: 1,
            }),
          ]
          expect(changeRequest).to.deep.equal(
            new PaymentProviderSubscriptionChangeRequest({
              subscription: ctx.subscription,
              timeframe: 'now',
              addOnUpdates: addOns,
              planCode: 'test_plan_code',
            })
          )
        })
      })

      describe('getRequestForPoNumberAndTermsAndConditionsUpdate()', function () {
        it('returns a correct update request', function (ctx) {
          const updateRequest =
            ctx.subscription.getRequestForPoNumberAndTermsAndConditionsUpdate(
              'O12345',
              'T&C copy'
            )
          expect(updateRequest).to.deep.equal(
            new PaymentProviderSubscriptionUpdateRequest({
              subscription: ctx.subscription,
              poNumber: 'O12345',
              termsAndConditions: 'T&C copy',
            })
          )
        })
      })

      describe('getRequestForTermsAndConditionsUpdate()', function () {
        it('returns a correct update request', function (ctx) {
          const updateRequest =
            ctx.subscription.getRequestForTermsAndConditionsUpdate('T&C copy')
          expect(updateRequest).to.deep.equal(
            new PaymentProviderSubscriptionUpdateRequest({
              subscription: ctx.subscription,
              termsAndConditions: 'T&C copy',
            })
          )
        })
      })

      describe('with an add-on pending cancellation', function () {
        beforeEach(function (ctx) {
          ctx.subscription.pendingChange =
            new PaymentProviderSubscriptionChange({
              subscription: ctx.subscription,
              nextPlanCode: ctx.subscription.planCode,
              nextPlanName: ctx.subscription.planName,
              nextPlanPrice: ctx.subscription.planPrice,
              nextAddOns: [],
            })
        })

        describe('getRequestForAddOnReactivation()', function () {
          it('returns a change request', function (ctx) {
            const changeRequest =
              ctx.subscription.getRequestForAddOnReactivation(ctx.addOn.code)
            expect(changeRequest).to.deep.equal(
              new PaymentProviderSubscriptionChangeRequest({
                subscription: ctx.subscription,
                timeframe: 'term_end',
                addOnUpdates: [ctx.addOn.toAddOnUpdate()],
              })
            )
          })

          it('throws an AddOnNotPresentError if given the wrong add-on', function (ctx) {
            expect(() =>
              ctx.subscription.getRequestForAddOnReactivation('some-add-on')
            ).to.throw(Errors.AddOnNotPresentError)
          })
        })

        describe('getRequestForPlanRevert()', function () {
          beforeEach(function (ctx) {
            const { PaymentProviderSubscription } = ctx.PaymentProviderEntities
            ctx.subscription = new PaymentProviderSubscription({
              id: 'subscription-id',
              userId: 'user-id',
              planCode: 'regular-plan',
              planName: 'My Plan',
              planPrice: 10,
              addOns: [
                {
                  addOnCode: 'addon-1',
                  quantity: 2,
                  unitAmountInCents: 500,
                },
                {
                  addOnCode: 'addon-2',
                  quantity: 1,
                  unitAmountInCents: 600,
                },
              ],
              subtotal: 10.99,
              taxRate: 0.2,
              taxAmount: 2.4,
              total: 14.4,
              currency: 'USD',
            })
          })

          it('throws if the plan to revert to doesnt exist', function (ctx) {
            const invalidPlanCode = 'non-existent-plan'
            expect(() =>
              ctx.subscription.getRequestForPlanRevert(invalidPlanCode, null)
            ).to.throw('Unable to find plan in settings')
          })

          it('creates a change request with the restore point', function (ctx) {
            const previousPlanCode = 'cheap-plan'
            const previousAddOns = [
              { addOnCode: 'addon-1', quantity: 1, unitAmountInCents: 500 },
            ]
            const changeRequest = ctx.subscription.getRequestForPlanRevert(
              previousPlanCode,
              previousAddOns
            )
            expect(changeRequest).to.be.an.instanceOf(
              ctx.PaymentProviderEntities
                .PaymentProviderSubscriptionChangeRequest
            )
            expect(changeRequest.planCode).to.equal(previousPlanCode)
            expect(changeRequest.addOnUpdates).to.deep.equal([
              {
                code: 'addon-1',
                quantity: 1,
                unitPrice: 5,
              },
            ])
          })

          it('defaults to addons to an empty array to clear the addon state', function (ctx) {
            const previousPlanCode = 'cheap-plan'
            const changeRequest = ctx.subscription.getRequestForPlanRevert(
              previousPlanCode,
              null
            )
            expect(changeRequest.addOnUpdates).to.deep.equal([])
          })
        })
      })
    })

    describe('without add-ons', function () {
      beforeEach(function (ctx) {
        const { PaymentProviderSubscription } = ctx.PaymentProviderEntities
        ctx.subscription = new PaymentProviderSubscription({
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
        it('returns false for any add-on', function (ctx) {
          expect(ctx.subscription.hasAddOn('some-add-on')).to.be.false
        })
      })

      describe('getRequestForAddOnPurchase()', function () {
        it('returns a change request', function (ctx) {
          const {
            PaymentProviderSubscriptionChangeRequest,
            PaymentProviderSubscriptionAddOnUpdate,
          } = ctx.PaymentProviderEntities
          const changeRequest =
            ctx.subscription.getRequestForAddOnPurchase('some-add-on')
          expect(changeRequest).to.deep.equal(
            new PaymentProviderSubscriptionChangeRequest({
              subscription: ctx.subscription,
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
        it('throws an AddOnNotPresentError', function (ctx) {
          expect(() =>
            ctx.subscription.getRequestForAddOnRemoval('some-add-on')
          ).to.throw(Errors.AddOnNotPresentError)
        })
      })

      describe('getRequestForAddOnReactivation()', function () {
        it('throws an AddOnNotPresentError', function (ctx) {
          expect(() =>
            ctx.subscription.getRequestForAddOnReactivation('some-add-on')
          ).to.throw(Errors.AddOnNotPresentError)
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
