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

// add-ons directly accessed through recurly
export type RecurlyAddOn = {
  add_on_code: string
  quantity: number
  unit_amount_in_cents: number
  displayPrice: string
}

export type PendingRecurlyPlan = {
  annual?: boolean
  displayPrice?: string
  featureDescription?: Record<string, unknown>[]
  addOns?: RecurlyAddOn[]
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
