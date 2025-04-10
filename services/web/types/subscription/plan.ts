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

export type StripeLookupKey =
  | 'collaborator_monthly'
  | 'collaborator_annual'
  | 'professional_monthly'
  | 'professional_annual'
  | 'student_monthly'
  | 'student_annual'
