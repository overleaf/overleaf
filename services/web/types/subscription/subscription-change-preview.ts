export type ImmediateCharge = {
  subtotal: number
  tax: number
  total: number
  discount: number
  lineItems: {
    planCode: string | null | undefined
    description: string
    subtotal: number
    discount: number
    tax: number
    isAiAssist?: boolean
  }[]
}

export type SubscriptionChangePreview = {
  change: SubscriptionChangeDescription
  currency: string
  paymentMethod: string | undefined
  netTerms: number
  nextPlan: {
    annual: boolean
  }
  immediateCharge: ImmediateCharge
  nextInvoice: {
    date: string
    plan: {
      name: string
      amount: number
    }
    addOns: AddOn[]
    subtotal: number
    tax: {
      rate: number
      amount: number
    }
    total: number
  }
}

type AddOn = {
  code: string
  name: string
  quantity: number
  unitAmount: number
  amount: number
}

export type SubscriptionChangeDescription =
  | AddOnPurchase
  | AddOnUpdate
  | GroupPlanUpgrade
  | PremiumSubscriptionChange

export type AddOnPurchase = {
  type: 'add-on-purchase'
  addOn: Pick<AddOn, 'code' | 'name'>
}

export type AddOnUpdate = {
  type: 'add-on-update'
  addOn: Pick<AddOn, 'code' | 'quantity'> & {
    prevQuantity: AddOn['quantity']
  }
}

export type GroupPlanUpgrade = {
  type: 'group-plan-upgrade'
  prevPlan: {
    name: string
  }
}

export type PremiumSubscriptionChange = {
  type: 'premium-subscription'
  plan: {
    code: string
    name: string
  }
}
