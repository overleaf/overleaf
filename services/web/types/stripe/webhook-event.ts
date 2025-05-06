export type CustomerSubscriptionWebhookEvent = {
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
