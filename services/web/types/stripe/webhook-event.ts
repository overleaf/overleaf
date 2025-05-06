type CustomerSubscriptionCreated = {
  type: 'customer.subscription.created'
  data: {
    object: {
      id: string
      metadata: {
        adminUserId?: string
      }
    }
  }
}

export type WebhookEvent = CustomerSubscriptionCreated
