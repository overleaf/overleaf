import Stripe from 'stripe'

type StripeWebhookEventType =
  | 'customer.subscription.created'
  | 'customer.subscription.updated'
  | 'customer.subscription.deleted'

export type CustomerSubscriptionWebhookEvent = {
  type: StripeWebhookEventType
  data: {
    object: Stripe.Subscription & {
      metadata: {
        adminUserId?: string
      }
    }
  }
}
