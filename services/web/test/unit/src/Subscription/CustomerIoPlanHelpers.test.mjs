import { expect } from 'vitest'
import CustomerIoPlanHelpers from '../../../../app/src/Features/Subscription/CustomerIoPlanHelpers.mjs'

describe('CustomerIoPlanHelpers', function () {
  describe('getPlanProperties past_due', function () {
    function buildArgs(individualSubscription) {
      return {
        bestSubscription: { type: 'individual' },
        individualSubscription,
        individualPaymentRecord: null,
        memberGroupSubscriptions: [],
        managedGroupSubscriptions: [],
        userIsMemberOfGroupSubscription: false,
        hasCommons: false,
        writefullData: null,
      }
    }

    it('is true when the Stripe subscription state is past_due', function () {
      const properties = CustomerIoPlanHelpers.getPlanProperties(
        buildArgs({
          planCode: 'collaborator',
          groupPlan: false,
          paymentProvider: { service: 'stripe-us', state: 'past_due' },
        })
      )
      expect(properties.past_due).to.equal(true)
    })

    it('is true when the Recurly subscription state is past_due', function () {
      const properties = CustomerIoPlanHelpers.getPlanProperties(
        buildArgs({
          planCode: 'collaborator',
          groupPlan: false,
          recurlyStatus: { state: 'past_due' },
        })
      )
      expect(properties.past_due).to.equal(true)
    })

    it("is true when a group admin's group subscription is past_due", function () {
      const properties = CustomerIoPlanHelpers.getPlanProperties(
        buildArgs({
          planCode: 'group_collaborator',
          groupPlan: true,
          paymentProvider: { service: 'stripe-us', state: 'past_due' },
        })
      )
      expect(properties.past_due).to.equal(true)
    })

    it('is false for an active Stripe subscription', function () {
      const properties = CustomerIoPlanHelpers.getPlanProperties(
        buildArgs({
          planCode: 'collaborator',
          groupPlan: false,
          paymentProvider: { service: 'stripe-us', state: 'active' },
        })
      )
      expect(properties.past_due).to.equal(false)
    })

    it('is false for cancelled, expired, paused, and trial states', function () {
      for (const state of ['cancelled', 'expired', 'paused', 'trial']) {
        const properties = CustomerIoPlanHelpers.getPlanProperties(
          buildArgs({
            planCode: 'collaborator',
            groupPlan: false,
            paymentProvider: { service: 'stripe-us', state },
          })
        )
        expect(properties.past_due, `state=${state}`).to.equal(false)
      }
    })

    it('is false when there is no individual subscription (free user / member-only)', function () {
      const properties = CustomerIoPlanHelpers.getPlanProperties(
        buildArgs(undefined)
      )
      expect(properties.past_due).to.equal(false)
    })
  })

  describe('getAffiliationProperties', function () {
    it('sets enterprise_commons=true when the user has active commons access at an enterprise_commons institution', function () {
      const properties = CustomerIoPlanHelpers.getAffiliationProperties([
        {
          emailHasInstitutionLicence: true,
          affiliation: {
            institution: { commonsAccount: true, enterpriseCommons: true },
          },
        },
      ])
      expect(properties.enterprise_commons).to.equal(true)
    })

    it('sets enterprise_commons=false when affiliated with an enterprise_commons institution but without active commons access', function () {
      const properties = CustomerIoPlanHelpers.getAffiliationProperties([
        {
          emailHasInstitutionLicence: false,
          affiliation: {
            institution: { commonsAccount: true, enterpriseCommons: true },
          },
        },
      ])
      expect(properties.enterprise_commons).to.equal(false)
    })

    it('sets enterprise_commons=false when active access is not at an enterprise_commons institution', function () {
      const properties = CustomerIoPlanHelpers.getAffiliationProperties([
        {
          emailHasInstitutionLicence: true,
          affiliation: {
            institution: { commonsAccount: true, enterpriseCommons: false },
          },
        },
      ])
      expect(properties.enterprise_commons).to.equal(false)
    })

    it('sets enterprise_commons=false when there are no emails', function () {
      const properties = CustomerIoPlanHelpers.getAffiliationProperties([])
      expect(properties.enterprise_commons).to.equal(false)
    })

    it('sets domain_capture=true when an affiliation has domain capture enabled', function () {
      const properties = CustomerIoPlanHelpers.getAffiliationProperties([
        {
          affiliation: {
            institution: {},
            group: { domainCaptureEnabled: true },
          },
        },
      ])
      expect(properties.domain_capture).to.equal(true)
    })

    it('sets domain_capture=false when no affiliation has domain capture enabled', function () {
      const properties = CustomerIoPlanHelpers.getAffiliationProperties([
        { affiliation: { institution: {} } },
      ])
      expect(properties.domain_capture).to.equal(false)
    })
  })
})
