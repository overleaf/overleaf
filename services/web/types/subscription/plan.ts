import { StripeCurrencyCode } from './currency'

type Features = {
  collaborators: number
  compileGroup: string
  compileTimeout: number
  dropbox: boolean
  gitBridge: boolean
  github: boolean
  mendeley: boolean
  references: boolean
  referencesSearch: boolean
  symbolPalette: boolean
  templates: boolean
  trackChanges: boolean
  versioning: boolean
  zotero: boolean
}

// add-ons stored on the subscription
export type AddOn = {
  addOnCode: string
  quantity: number
  unitAmountInCents: number
}

// add-ons directly accessed through payment
export type PaymentProviderAddOn = {
  code: string
  name: string
  quantity: number
  unitPrice: number
  amount?: number
  displayPrice?: string
}

export type PendingPaymentProviderPlan = {
  annual?: boolean
  displayPrice?: string
  featureDescription?: Record<string, unknown>[]
  addOns?: PaymentProviderAddOn[]
  features?: Features
  groupPlan?: boolean
  hideFromUsers?: boolean
  membersLimit?: number
  membersLimitAddOn?: string
  name: string
  planCode: string
  price_in_cents: number
}

export type Plan = {
  annual?: boolean
  displayPrice?: string
  featureDescription?: Record<string, unknown>[]
  addOns?: AddOn[]
  features?: Features
  groupPlan?: boolean
  hideFromUsers?: boolean
  membersLimit?: number
  membersLimitAddOn?: string
  name: string
  planCode: string
  price_in_cents: number
  canUseFlexibleLicensing?: boolean
}

export type PriceForDisplayData = {
  totalForDisplay: string
  totalAsNumber: number
  subtotal: string
  tax: string
  includesTax: boolean
  perUserDisplayPrice?: string
}

export type RecurlyPlanCode =
  | 'collaborator'
  | 'collaborator-annual'
  | 'collaborator_free_trial_7_days'
  | 'professional'
  | 'professional-annual'
  | 'professional_free_trial_7_days'
  | 'student'
  | 'student-annual'
  | 'student_free_trial_7_days'
  | 'group_professional'
  | 'group_professional_educational'
  | 'group_collaborator'
  | 'group_collaborator_educational'
  | 'assistant'
  | 'assistant-annual'

export type RecurlyAddOnCode = 'assistant'

export type StripeBaseLookupKey =
  | 'standard_monthly'
  | 'standard_annual'
  | 'professional_monthly'
  | 'professional_annual'
  | 'student_monthly'
  | 'student_annual'
  | 'assistant_annual'
  | 'assistant_monthly'
  // TODO: change all group plans' lookup_keys to match the UK account after they have been added
  | 'group_standard_enterprise'
  | 'group_professional_enterprise'
  | 'group_standard_educational'
  | 'group_professional_educational'

// Keep in sync with LATEST_STRIPE_LOOKUP_KEY_VERSION in PlansLocator.mjs
export type StripeLookupKeyVersion = 'nov2025'

export type StripeLookupKey =
  `${StripeBaseLookupKey}_${StripeLookupKeyVersion}_${StripeCurrencyCode}`
