type StripeWebhookEventType =
  | 'customer.subscription.created'
  | 'customer.subscription.updated'
  | 'customer.subscription.deleted'

export type CustomerSubscriptionWebhookEvent = {
  type: StripeWebhookEventType
  data: {
    object: {
      id: string
      metadata: {
        adminUserId?: string
      }
    }
  }
}
