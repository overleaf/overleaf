export type SubscriptionChangePreview = {
  change: SubscriptionChangeDescription
  currency: string
  paymentMethod: string
  nextPlan: {
    annual: boolean
  }
  immediateCharge: {
    subtotal: number
    tax: number
    total: number
    discount: number
  }
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
