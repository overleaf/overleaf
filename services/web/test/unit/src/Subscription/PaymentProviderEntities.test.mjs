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
              addOnUpdates: [
                new PaymentProviderSubscriptionAddOnUpdate({
                  code: ctx.addOn.code,
                  quantity: ctx.addOn.quantity,
                  unitPrice: ctx.addOn.unitPrice,
                }),
              ],
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
              addOnUpdates: [
                new PaymentProviderSubscriptionAddOnUpdate({
                  code: ctx.addOn.code,
                  quantity: ctx.addOn.quantity,
                  unitPrice: ctx.addOn.unitPrice,
                }),
              ],
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
              addOnUpdates: [
                new PaymentProviderSubscriptionAddOnUpdate({
                  code: ctx.addOn.code,
                  quantity: ctx.addOn.quantity,
                  unitPrice: ctx.addOn.unitPrice,
                }),
              ],
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
                  unitPrice: ctx.addOn.unitPrice,
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
                  unitPrice: ctx.addOn.unitPrice,
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
                  code: ctx.addOn.code,
                  quantity: ctx.addOn.quantity,
                  unitPrice: ctx.addOn.unitPrice,
                }),
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
                  code: AI_ADD_ON_CODE,
                  quantity: 1,
                  unitPrice: ctx.addOn.unitPrice,
                }),
                new PaymentProviderSubscriptionAddOnUpdate({
                  code: 'additional-license',
                  quantity: 10,
                }),
              ],
            })
          )
        })

        describe('with pending add-on removal', function () {
          beforeEach(function (ctx) {
            // Reset to a subscription with an add-on and pending removal
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
            // Set up a pending change that removes the add-on at term_end
            ctx.subscription.pendingChange =
              new PaymentProviderSubscriptionChange({
                subscription: ctx.subscription,
                nextPlanCode: ctx.subscription.planCode,
                nextPlanName: ctx.subscription.planName,
                nextPlanPrice: ctx.subscription.planPrice,
                nextAddOns: [], // Add-on is scheduled to be removed
              })
          })

          it('preserves current add-ons for immediate upgrade', function (ctx) {
            const changeRequest = ctx.subscription.getRequestForPlanChange(
              'premium-plan',
              1,
              false // immediate change
            )
            expect(changeRequest.timeframe).to.equal('now')
            expect(changeRequest.addOnUpdates).to.deep.equal([
              new PaymentProviderSubscriptionAddOnUpdate({
                code: ctx.addOn.code,
                quantity: ctx.addOn.quantity,
                unitPrice: ctx.addOn.unitPrice,
              }),
            ])
          })

          it('stacks with pending add-on removal for term_end downgrade', function (ctx) {
            const changeRequest = ctx.subscription.getRequestForPlanChange(
              'cheap-plan',
              1,
              true // term_end change
            )
            expect(changeRequest.timeframe).to.equal('term_end')
            // Should have NO add-ons because the pending change already removed them
            expect(changeRequest.addOnUpdates).to.deep.equal([])
          })
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

        describe('with pending plan downgrade', function () {
          beforeEach(function (ctx) {
            // Scenario: downgrade is scheduled, and then they want to buy an add-on immediately
            const {
              PaymentProviderSubscription,
              PaymentProviderSubscriptionChange,
            } = ctx.PaymentProviderEntities
            ctx.subscription = new PaymentProviderSubscription({
              id: 'subscription-id',
              userId: 'user-id',
              planCode: 'premium-plan',
              planName: 'Premium Plan',
              planPrice: 20,
              addOns: [],
              subtotal: 20,
              taxRate: 0.2,
              taxAmount: 4,
              total: 24,
              currency: 'USD',
            })
            // Pending downgrade to cheaper plan at term_end
            ctx.subscription.pendingChange =
              new PaymentProviderSubscriptionChange({
                subscription: ctx.subscription,
                nextPlanCode: 'cheap-plan',
                nextPlanName: 'Cheap Plan',
                nextPlanPrice: 5,
                nextAddOns: [],
              })
          })

          it('uses current add-ons for immediate add-on purchase', function (ctx) {
            const changeRequest =
              ctx.subscription.getRequestForAddOnPurchase('assistant')
            expect(changeRequest.timeframe).to.equal('now')
            // Should only have the new add-on, based on current state, client will reapply the pending change
            expect(changeRequest.addOnUpdates).to.deep.equal([
              new PaymentProviderSubscriptionAddOnUpdate({
                code: 'assistant',
                quantity: 1,
              }),
            ])
          })
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

        describe('with pending changes', function () {
          beforeEach(function (ctx) {
            // Scenario: a subscription has two add-ons, one already scheduled for removal
            const {
              PaymentProviderSubscription,
              PaymentProviderSubscriptionAddOn,
            } = ctx.PaymentProviderEntities
            ctx.addOn1 = new PaymentProviderSubscriptionAddOn({
              code: 'addon-1',
              name: 'Add-On 1',
              quantity: 1,
              unitPrice: 2,
            })
            ctx.addOn2 = new PaymentProviderSubscriptionAddOn({
              code: 'addon-2',
              name: 'Add-On 2',
              quantity: 1,
              unitPrice: 3,
            })
            ctx.subscription = new PaymentProviderSubscription({
              id: 'subscription-id',
              userId: 'user-id',
              planCode: 'regular-plan',
              planName: 'My Plan',
              planPrice: 10,
              addOns: [ctx.addOn1, ctx.addOn2],
              subtotal: 10.99,
              taxRate: 0.2,
              taxAmount: 2.4,
              total: 14.4,
              currency: 'USD',
            })
            // Set up a pending change that removes addon-1 at term_end
            ctx.subscription.pendingChange =
              new PaymentProviderSubscriptionChange({
                subscription: ctx.subscription,
                nextPlanCode: ctx.subscription.planCode,
                nextPlanName: ctx.subscription.planName,
                nextPlanPrice: ctx.subscription.planPrice,
                nextAddOns: [ctx.addOn2], // Only addon-2 remains
              })
          })

          it('stacks multiple add-on removals at term_end', function (ctx) {
            const changeRequest =
              ctx.subscription.getRequestForAddOnRemoval('addon-2')
            expect(changeRequest.timeframe).to.equal('term_end')
            expect(changeRequest.addOnUpdates).to.deep.equal([]) // empty because both are scheduled for removal
          })
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

      describe('getRequestForPlanChangeCancellation()', function () {
        it('returns null when there is no pending change', function (ctx) {
          ctx.subscription.pendingChange = null
          const result = ctx.subscription.getRequestForPlanChangeCancellation()
          expect(result).to.be.null
        })

        it('returns null when pending change has no add-on changes', function (ctx) {
          // Same add-ons in pending change as current subscription
          ctx.subscription.pendingChange =
            new PaymentProviderSubscriptionChange({
              subscription: ctx.subscription,
              nextPlanCode: 'cheap-plan', // only plan change, no add-on change
              nextPlanName: 'Cheap Plan',
              nextPlanPrice: 5,
              nextAddOns: [ctx.addOn], // same add-on as current subscription
            })
          const result = ctx.subscription.getRequestForPlanChangeCancellation()
          expect(result).to.be.null
        })

        it('returns a change request preserving add-on removal when canceling plan change', function (ctx) {
          // Pending change has both plan downgrade AND add-on removal
          ctx.subscription.pendingChange =
            new PaymentProviderSubscriptionChange({
              subscription: ctx.subscription,
              nextPlanCode: 'cheap-plan',
              nextPlanName: 'Cheap Plan',
              nextPlanPrice: 5,
              nextAddOns: [], // add-on is being removed
            })

          const result = ctx.subscription.getRequestForPlanChangeCancellation()
          expect(result).to.not.be.null
          expect(result.timeframe).to.equal('term_end')
          expect(result.planCode).to.equal(ctx.subscription.planCode) // keep current plan
          expect(result.addOnUpdates).to.deep.equal([]) // preserve add-on removal
        })

        it('returns a change request preserving add-on addition when canceling plan change', function (ctx) {
          const {
            PaymentProviderSubscriptionAddOn,
            PaymentProviderSubscriptionAddOnUpdate,
          } = ctx.PaymentProviderEntities

          // Current subscription has one add-on
          // Pending change has plan downgrade AND a new add-on
          const newAddOn = new PaymentProviderSubscriptionAddOn({
            code: 'new-addon',
            name: 'New Add-On',
            quantity: 1,
            unitPrice: 3,
          })
          ctx.subscription.pendingChange =
            new PaymentProviderSubscriptionChange({
              subscription: ctx.subscription,
              nextPlanCode: 'cheap-plan',
              nextPlanName: 'Cheap Plan',
              nextPlanPrice: 5,
              nextAddOns: [ctx.addOn, newAddOn], // current add-on plus new one
            })

          const result = ctx.subscription.getRequestForPlanChangeCancellation()
          expect(result).to.not.be.null
          expect(result.timeframe).to.equal('term_end')
          expect(result.planCode).to.equal(ctx.subscription.planCode) // keep current plan
          expect(result.addOnUpdates).to.deep.equal([
            new PaymentProviderSubscriptionAddOnUpdate({
              code: ctx.addOn.code,
              quantity: ctx.addOn.quantity,
              unitPrice: ctx.addOn.unitPrice,
            }),
            new PaymentProviderSubscriptionAddOnUpdate({
              code: newAddOn.code,
              quantity: newAddOn.quantity,
              unitPrice: newAddOn.unitPrice,
            }),
          ])
        })

        it('removes additional-license add-on when canceling pending group plan upgrade', function (ctx) {
          const { MEMBERS_LIMIT_ADD_ON_CODE } = ctx.PaymentProviderEntities

          // Current: professional-annual (no add-ons, not a group plan)
          ctx.subscription.planCode = 'professional-annual'
          ctx.subscription.planName = 'Professional Annual'
          ctx.subscription.addOns = []

          // Pending: group_professional_10_educational + 5 additional-license
          const additionalLicenseAddOn =
            new ctx.PaymentProviderEntities.PaymentProviderSubscriptionAddOn({
              code: MEMBERS_LIMIT_ADD_ON_CODE,
              name: 'Additional License',
              quantity: 5,
              unitPrice: 10,
            })

          ctx.subscription.pendingChange =
            new PaymentProviderSubscriptionChange({
              subscription: ctx.subscription,
              nextPlanCode: 'group_professional_10_educational',
              nextPlanName: 'Group Professional Educational',
              nextPlanPrice: 100,
              nextAddOns: [additionalLicenseAddOn],
            })

          const result = ctx.subscription.getRequestForPlanChangeCancellation()

          // Should return a change request that keeps the current plan
          // but removes the additional-license add-on
          expect(result).to.not.be.null
          expect(result.timeframe).to.equal('term_end')
          expect(result.planCode).to.equal('professional-annual')
          expect(result.addOnUpdates).to.deep.equal([])
        })

        it('preserves non-members-limit add-ons when canceling pending group plan upgrade', function (ctx) {
          const { MEMBERS_LIMIT_ADD_ON_CODE } = ctx.PaymentProviderEntities

          // Current: professional-annual with AI add-on (not a group plan)
          ctx.subscription.planCode = 'professional-annual'
          ctx.subscription.planName = 'Professional Annual'
          const aiAddOn =
            new ctx.PaymentProviderEntities.PaymentProviderSubscriptionAddOn({
              code: AI_ADD_ON_CODE,
              name: 'AI Add-On',
              quantity: 1,
              unitPrice: 20,
            })
          ctx.subscription.addOns = [aiAddOn]

          // Pending: group_professional_10_educational + AI add-on + 5 additional-license
          const additionalLicenseAddOn =
            new ctx.PaymentProviderEntities.PaymentProviderSubscriptionAddOn({
              code: MEMBERS_LIMIT_ADD_ON_CODE,
              name: 'Additional License',
              quantity: 5,
              unitPrice: 10,
            })

          ctx.subscription.pendingChange =
            new PaymentProviderSubscriptionChange({
              subscription: ctx.subscription,
              nextPlanCode: 'group_professional_10_educational',
              nextPlanName: 'Group Professional Educational',
              nextPlanPrice: 100,
              nextAddOns: [aiAddOn, additionalLicenseAddOn],
            })

          const result = ctx.subscription.getRequestForPlanChangeCancellation()

          // Should return a change request that keeps the current plan and AI add-on
          // but removes the additional-license add-on
          expect(result).to.not.be.null
          expect(result.timeframe).to.equal('term_end')
          expect(result.planCode).to.equal('professional-annual')
          expect(result.addOnUpdates).to.deep.equal([
            new PaymentProviderSubscriptionAddOnUpdate({
              code: AI_ADD_ON_CODE,
              quantity: 1,
              unitPrice: 20,
            }),
          ])
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
                planCode: ctx.subscription.pendingChange.nextPlanCode,
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
