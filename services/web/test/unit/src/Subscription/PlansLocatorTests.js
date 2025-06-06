const SandboxedModule = require('sandboxed-module')
const { expect } = require('chai')
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
  beforeEach(function () {
    this.settings = { plans }
    this.AI_ADD_ON_CODE = 'assistant'

    this.PlansLocator = SandboxedModule.require(modulePath, {
      requires: {
        '@overleaf/settings': this.settings,
      },
    })
  })

  describe('findLocalPlanInSettings', function () {
    it('should return the found plan', function () {
      const plan = this.PlansLocator.findLocalPlanInSettings('second')
      expect(plan).to.have.property('name', '2nd')
      expect(plan).to.have.property('price_in_cents', 1500)
    })
    it('should return null if no matching plan is found', function () {
      const plan = this.PlansLocator.findLocalPlanInSettings('gibberish')
      expect(plan).to.be.a('null')
    })
  })

  describe('mapRecurlyPlanCodeToStripeLookupKey', function () {
    it('should map "collaborator" plan code to stripe lookup keys', function () {
      const planCode = 'collaborator'
      const lookupKey =
        this.PlansLocator.mapRecurlyPlanCodeToStripeLookupKey(planCode)
      expect(lookupKey).to.equal('collaborator_may2025')
    })

    it('should map "collaborator_free_trial_7_days" plan code to stripe lookup keys', function () {
      const planCode = 'collaborator_free_trial_7_days'
      const lookupKey =
        this.PlansLocator.mapRecurlyPlanCodeToStripeLookupKey(planCode)
      expect(lookupKey).to.equal('collaborator_may2025')
    })

    it('should map "collaborator-annual" plan code to stripe lookup keys', function () {
      const planCode = 'collaborator-annual'
      const lookupKey =
        this.PlansLocator.mapRecurlyPlanCodeToStripeLookupKey(planCode)
      expect(lookupKey).to.equal('collaborator_annual_may2025')
    })

    it('should map "professional" plan code to stripe lookup keys', function () {
      const planCode = 'professional'
      const lookupKey =
        this.PlansLocator.mapRecurlyPlanCodeToStripeLookupKey(planCode)
      expect(lookupKey).to.equal('professional_may2025')
    })

    it('should map "professional_free_trial_7_days" plan code to stripe lookup keys', function () {
      const planCode = 'professional_free_trial_7_days'
      const lookupKey =
        this.PlansLocator.mapRecurlyPlanCodeToStripeLookupKey(planCode)
      expect(lookupKey).to.equal('professional_may2025')
    })

    it('should map "professional-annual" plan code to stripe lookup keys', function () {
      const planCode = 'professional-annual'
      const lookupKey =
        this.PlansLocator.mapRecurlyPlanCodeToStripeLookupKey(planCode)
      expect(lookupKey).to.equal('professional_annual_may2025')
    })

    it('should map "student" plan code to stripe lookup keys', function () {
      const planCode = 'student'
      const lookupKey =
        this.PlansLocator.mapRecurlyPlanCodeToStripeLookupKey(planCode)
      expect(lookupKey).to.equal('student_may2025')
    })

    it('shoult map "student_free_trial_7_days" plan code to stripe lookup keys', function () {
      const planCode = 'student_free_trial_7_days'
      const lookupKey =
        this.PlansLocator.mapRecurlyPlanCodeToStripeLookupKey(planCode)
      expect(lookupKey).to.equal('student_may2025')
    })

    it('should map "student-annual" plan code to stripe lookup keys', function () {
      const planCode = 'student-annual'
      const lookupKey =
        this.PlansLocator.mapRecurlyPlanCodeToStripeLookupKey(planCode)
      expect(lookupKey).to.equal('student_annual_may2025')
    })
  })

  describe('mapRecurlyAddOnCodeToStripeLookupKey', function () {
    it('should return null for unknown add-on codes', function () {
      const billingCycleInterval = 'month'
      const addOnCode = 'unknown_addon'
      const lookupKey = this.PlansLocator.mapRecurlyAddOnCodeToStripeLookupKey(
        addOnCode,
        billingCycleInterval
      )
      expect(lookupKey).to.equal(null)
    })

    it('should handle missing input', function () {
      const lookupKey = this.PlansLocator.mapRecurlyAddOnCodeToStripeLookupKey(
        undefined,
        undefined
      )
      expect(lookupKey).to.equal(null)
    })

    it('returns the key for a monthly AI assist add-on', function () {
      const billingCycleInterval = 'month'
      const addOnCode = this.AI_ADD_ON_CODE
      const lookupKey = this.PlansLocator.mapRecurlyAddOnCodeToStripeLookupKey(
        addOnCode,
        billingCycleInterval
      )
      expect(lookupKey).to.equal('assistant_may2025')
    })

    it('returns the key for an annual AI assist add-on', function () {
      const billingCycleInterval = 'year'
      const addOnCode = this.AI_ADD_ON_CODE
      const lookupKey = this.PlansLocator.mapRecurlyAddOnCodeToStripeLookupKey(
        addOnCode,
        billingCycleInterval
      )
      expect(lookupKey).to.equal('assistant_annual_may2025')
    })
  })

  describe('getPlanTypeAndPeriodFromRecurlyPlanCode', function () {
    it('should return the plan type and period for "collaborator"', function () {
      const { planType, period } =
        this.PlansLocator.getPlanTypeAndPeriodFromRecurlyPlanCode(
          'collaborator'
        )
      expect(planType).to.equal('individual')
      expect(period).to.equal('monthly')
    })

    it('should return the plan type and period for "collaborator_free_trial_7_days"', function () {
      const { planType, period } =
        this.PlansLocator.getPlanTypeAndPeriodFromRecurlyPlanCode(
          'collaborator_free_trial_7_days'
        )
      expect(planType).to.equal('individual')
      expect(period).to.equal('monthly')
    })

    it('should return the plan type and period for "collaborator-annual"', function () {
      const { planType, period } =
        this.PlansLocator.getPlanTypeAndPeriodFromRecurlyPlanCode(
          'collaborator-annual'
        )
      expect(planType).to.equal('individual')
      expect(period).to.equal('annual')
    })

    it('should return the plan type and period for "professional"', function () {
      const { planType, period } =
        this.PlansLocator.getPlanTypeAndPeriodFromRecurlyPlanCode(
          'professional'
        )
      expect(planType).to.equal('individual')
      expect(period).to.equal('monthly')
    })

    it('should return the plan type and period for "professional_free_trial_7_days"', function () {
      const { planType, period } =
        this.PlansLocator.getPlanTypeAndPeriodFromRecurlyPlanCode(
          'professional_free_trial_7_days'
        )
      expect(planType).to.equal('individual')
      expect(period).to.equal('monthly')
    })

    it('should return the plan type and period for "professional-annual"', function () {
      const { planType, period } =
        this.PlansLocator.getPlanTypeAndPeriodFromRecurlyPlanCode(
          'professional-annual'
        )
      expect(planType).to.equal('individual')
      expect(period).to.equal('annual')
    })

    it('should return the plan type and period for "student"', function () {
      const { planType, period } =
        this.PlansLocator.getPlanTypeAndPeriodFromRecurlyPlanCode('student')
      expect(planType).to.equal('student')
      expect(period).to.equal('monthly')
    })

    it('should return the plan type and period for "student_free_trial_7_days"', function () {
      const { planType, period } =
        this.PlansLocator.getPlanTypeAndPeriodFromRecurlyPlanCode(
          'student_free_trial_7_days'
        )
      expect(planType).to.equal('student')
      expect(period).to.equal('monthly')
    })

    it('should return the plan type and period for "student-annual"', function () {
      const { planType, period } =
        this.PlansLocator.getPlanTypeAndPeriodFromRecurlyPlanCode(
          'student-annual'
        )
      expect(planType).to.equal('student')
      expect(period).to.equal('annual')
    })
  })
})
