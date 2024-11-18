export type SubscriptionChangePreview = {
  change: SubscriptionChange
  currency: string
  paymentMethod: string
  immediateCharge: number
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

type SubscriptionChange = AddOnPurchase

type AddOnPurchase = {
  type: 'add-on-purchase'
  addOn: {
    code: string
    name: string
  }
}
