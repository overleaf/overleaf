import { vi, expect } from 'vitest'
const modulePath = '../../../../app/src/Features/Subscription/PlansLocator'

const plans = [
  {
    planCode: 'first',
    name: '1st',
    price_in_cents: 800,
    features: {},
    featureDescription: {},
  },
  {
    planCode: 'second',
    name: '2nd',
    price_in_cents: 1500,
    features: {},
    featureDescription: {},
  },
  {
    planCode: 'third',
    name: '3rd',
    price_in_cents: 3000,
    features: {},
    featureDescription: {},
  },
]

describe('PlansLocator', function () {
  beforeEach(async function (ctx) {
    ctx.settings = { plans }
    ctx.AI_ADD_ON_CODE = 'assistant'

    vi.doMock('@overleaf/settings', () => ({
      default: ctx.settings,
    }))

    ctx.PlansLocator = (await import(modulePath)).default
  })

  describe('findLocalPlanInSettings', function () {
    it('should return the found plan', function (ctx) {
      const plan = ctx.PlansLocator.findLocalPlanInSettings('second')
      expect(plan).to.have.property('name', '2nd')
      expect(plan).to.have.property('price_in_cents', 1500)
    })
    it('should return null if no matching plan is found', function (ctx) {
      const plan = ctx.PlansLocator.findLocalPlanInSettings('gibberish')
      expect(plan).to.be.a('null')
    })
  })

  describe('buildStripeLookupKey', function () {
    it('should map "collaborator" plan code to stripe lookup keys', function (ctx) {
      const planCode = 'collaborator'
      const currency = 'eur'
      const lookupKey = ctx.PlansLocator.buildStripeLookupKey(
        planCode,
        currency
      )
      expect(lookupKey).to.equal('standard_monthly_nov2025_eur')
    })

    it('should map "collaborator_free_trial_7_days" plan code to stripe lookup keys', function (ctx) {
      const planCode = 'collaborator_free_trial_7_days'
      const currency = 'eur'
      const lookupKey = ctx.PlansLocator.buildStripeLookupKey(
        planCode,
        currency
      )
      expect(lookupKey).to.equal('standard_monthly_nov2025_eur')
    })

    it('should map "collaborator-annual" plan code to stripe lookup keys', function (ctx) {
      const planCode = 'collaborator-annual'
      const currency = 'eur'
      const lookupKey = ctx.PlansLocator.buildStripeLookupKey(
        planCode,
        currency
      )
      expect(lookupKey).to.equal('standard_annual_nov2025_eur')
    })

    it('should map "professional" plan code to stripe lookup keys', function (ctx) {
      const planCode = 'professional'
      const currency = 'eur'
      const lookupKey = ctx.PlansLocator.buildStripeLookupKey(
        planCode,
        currency
      )
      expect(lookupKey).to.equal('professional_monthly_nov2025_eur')
    })

    it('should map "professional_free_trial_7_days" plan code to stripe lookup keys', function (ctx) {
      const planCode = 'professional_free_trial_7_days'
      const currency = 'eur'
      const lookupKey = ctx.PlansLocator.buildStripeLookupKey(
        planCode,
        currency
      )
      expect(lookupKey).to.equal('professional_monthly_nov2025_eur')
    })

    it('should map "professional-annual" plan code to stripe lookup keys', function (ctx) {
      const planCode = 'professional-annual'
      const currency = 'eur'
      const lookupKey = ctx.PlansLocator.buildStripeLookupKey(
        planCode,
        currency
      )
      expect(lookupKey).to.equal('professional_annual_nov2025_eur')
    })

    it('should map "student" plan code to stripe lookup keys', function (ctx) {
      const planCode = 'student'
      const currency = 'eur'
      const lookupKey = ctx.PlansLocator.buildStripeLookupKey(
        planCode,
        currency
      )
      expect(lookupKey).to.equal('student_monthly_nov2025_eur')
    })

    it('shoult map "student_free_trial_7_days" plan code to stripe lookup keys', function (ctx) {
      const planCode = 'student_free_trial_7_days'
      const currency = 'eur'
      const lookupKey = ctx.PlansLocator.buildStripeLookupKey(
        planCode,
        currency
      )
      expect(lookupKey).to.equal('student_monthly_nov2025_eur')
    })

    it('should map "student-annual" plan code to stripe lookup keys', function (ctx) {
      const planCode = 'student-annual'
      const currency = 'eur'
      const lookupKey = ctx.PlansLocator.buildStripeLookupKey(
        planCode,
        currency
      )
      expect(lookupKey).to.equal('student_annual_nov2025_eur')
    })

    it('should return null for unknown add-on codes', function (ctx) {
      const billingCycleInterval = 'month'
      const addOnCode = 'unknown_addon'
      const currency = 'gbp'
      const lookupKey = ctx.PlansLocator.buildStripeLookupKey(
        addOnCode,
        currency,
        billingCycleInterval
      )
      expect(lookupKey).to.equal(null)
    })

    it('should handle missing input', function (ctx) {
      const lookupKey = ctx.PlansLocator.buildStripeLookupKey(
        undefined,
        undefined
      )
      expect(lookupKey).to.equal(null)
    })

    it('returns the key for a monthly AI assist add-on', function (ctx) {
      const billingCycleInterval = 'month'
      const addOnCode = ctx.AI_ADD_ON_CODE
      const currency = 'gbp'
      const lookupKey = ctx.PlansLocator.buildStripeLookupKey(
        addOnCode,
        currency,
        billingCycleInterval
      )
      expect(lookupKey).to.equal('assistant_monthly_nov2025_gbp')
    })

    it('returns the key for an annual AI assist add-on', function (ctx) {
      const billingCycleInterval = 'year'
      const addOnCode = ctx.AI_ADD_ON_CODE
      const currency = 'gbp'
      const lookupKey = ctx.PlansLocator.buildStripeLookupKey(
        addOnCode,
        currency,
        billingCycleInterval
      )
      expect(lookupKey).to.equal('assistant_annual_nov2025_gbp')
    })
  })

  describe('getPlanTypeAndPeriodFromRecurlyPlanCode', function () {
    it('should return the plan type and period for "collaborator"', function (ctx) {
      const { planType, period } =
        ctx.PlansLocator.getPlanTypeAndPeriodFromRecurlyPlanCode('collaborator')
      expect(planType).to.equal('individual')
      expect(period).to.equal('monthly')
    })

    it('should return the plan type and period for "collaborator_free_trial_7_days"', function (ctx) {
      const { planType, period } =
        ctx.PlansLocator.getPlanTypeAndPeriodFromRecurlyPlanCode(
          'collaborator_free_trial_7_days'
        )
      expect(planType).to.equal('individual')
      expect(period).to.equal('monthly')
    })

    it('should return the plan type and period for "collaborator-annual"', function (ctx) {
      const { planType, period } =
        ctx.PlansLocator.getPlanTypeAndPeriodFromRecurlyPlanCode(
          'collaborator-annual'
        )
      expect(planType).to.equal('individual')
      expect(period).to.equal('annual')
    })

    it('should return the plan type and period for "professional"', function (ctx) {
      const { planType, period } =
        ctx.PlansLocator.getPlanTypeAndPeriodFromRecurlyPlanCode('professional')
      expect(planType).to.equal('individual')
      expect(period).to.equal('monthly')
    })

    it('should return the plan type and period for "professional_free_trial_7_days"', function (ctx) {
      const { planType, period } =
        ctx.PlansLocator.getPlanTypeAndPeriodFromRecurlyPlanCode(
          'professional_free_trial_7_days'
        )
      expect(planType).to.equal('individual')
      expect(period).to.equal('monthly')
    })

    it('should return the plan type and period for "professional-annual"', function (ctx) {
      const { planType, period } =
        ctx.PlansLocator.getPlanTypeAndPeriodFromRecurlyPlanCode(
          'professional-annual'
        )
      expect(planType).to.equal('individual')
      expect(period).to.equal('annual')
    })

    it('should return the plan type and period for "student"', function (ctx) {
      const { planType, period } =
        ctx.PlansLocator.getPlanTypeAndPeriodFromRecurlyPlanCode('student')
      expect(planType).to.equal('student')
      expect(period).to.equal('monthly')
    })

    it('should return the plan type and period for "student_free_trial_7_days"', function (ctx) {
      const { planType, period } =
        ctx.PlansLocator.getPlanTypeAndPeriodFromRecurlyPlanCode(
          'student_free_trial_7_days'
        )
      expect(planType).to.equal('student')
      expect(period).to.equal('monthly')
    })

    it('should return the plan type and period for "student-annual"', function (ctx) {
      const { planType, period } =
        ctx.PlansLocator.getPlanTypeAndPeriodFromRecurlyPlanCode(
          'student-annual'
        )
      expect(planType).to.equal('student')
      expect(period).to.equal('annual')
    })
  })

  describe('convertLegacyGroupPlanCodeToConsolidatedGroupPlanCodeIfNeeded', function () {
    it('returns original plan name for non-group plan codes', function (ctx) {
      expect(
        ctx.PlansLocator.convertLegacyGroupPlanCodeToConsolidatedGroupPlanCodeIfNeeded(
          'professional'
        )
      ).to.deep.equal({
        planCode: 'professional',
        quantity: 1,
      })
    })

    it('converts Recurly enterprise group plan codes to Stripe group plan codes', function (ctx) {
      expect(
        ctx.PlansLocator.convertLegacyGroupPlanCodeToConsolidatedGroupPlanCodeIfNeeded(
          'group_collaborator_10_enterprise'
        )
      ).to.deep.equal({
        planCode: 'group_collaborator',
        quantity: 10,
      })
    })

    it('converts Recurly educational group plan codes to Stripe group plan codes', function (ctx) {
      expect(
        ctx.PlansLocator.convertLegacyGroupPlanCodeToConsolidatedGroupPlanCodeIfNeeded(
          'group_professional_10_educational'
        )
      ).to.deep.equal({
        planCode: 'group_professional_educational',
        quantity: 10,
      })
    })
  })
})
