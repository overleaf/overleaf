import Stripe from 'stripe'

export type CustomerSubscriptionUpdatedWebhookEvent = {
  type: 'customer.subscription.updated'
  data: {
    object: Stripe.Subscription & {
      metadata: {
        adminUserId?: string
      }
      customer: string
    }
    // https://docs.stripe.com/api/events/object?api-version=2025-04-30.basil#event_object-data-previous_attributes
    previous_attributes: {
      cancel_at_period_end?: boolean // will only be present if the subscription was cancelled or reactivated
      items?: {
        // will be present if the subscription was downgraded, upgraded, or renewed
        data: [
          {
            price: {
              id: string
            }
            quantity: number
          },
        ]
      }
      status?: Stripe.Subscription.Status
      metadata?: Record<string, string>
    }
  }
}

export type CustomerSubscriptionCreatedWebhookEvent = {
  type: 'customer.subscription.created'
  data: {
    object: Stripe.Subscription & {
      metadata: {
        adminUserId?: string
      }
      customer: string
    }
  }
}

export type CustomerSubscriptionsDeletedWebhookEvent = {
  type: 'customer.subscription.deleted'
  data: {
    object: Stripe.Subscription & {
      metadata: {
        adminUserId?: string
      }
      customer: string
    }
  }
}

export type InvoicePaidWebhookEvent = {
  type: 'invoice.paid'
  data: {
    object: Stripe.Invoice & {
      parent: Stripe.Invoice.Parent & {
        subscription_details: Stripe.Invoice.Parent.SubscriptionDetails & {
          metadata: {
            adminUserId?: string
          }
        }
      }
    }
  }
  request: Stripe.Event.Request
}

export type PaymentIntentPaymentFailedWebhookEvent = {
  type: 'payment_intent.payment_failed'
  data: {
    object: Stripe.PaymentIntent
  }
  request: Stripe.Event.Request
}

export type SetupIntentSetupFailedWebhookEvent = {
  type: 'setup_intent.setup_failed'
  data: {
    object: Stripe.SetupIntent & {
      metadata: {
        userId?: string
        isTrial?: string
        checkoutSource?: 'hosted-checkout' | 'elements-checkout' | undefined
      }
    }
  }
  request: Stripe.Event.Request
}

export type SetupIntentSucceededWebhookEvent = {
  type: 'setup_intent.succeeded'
  data: {
    object: Stripe.SetupIntent & {
      metadata: {
        userId?: string
        isTrial?: string
        checkoutSource?: 'hosted-checkout' | 'elements-checkout' | undefined
      }
    }
  }
  request: Stripe.Event.Request
}

export type InvoiceVoidedWebhookEvent = {
  type: 'invoice.voided'
  data: {
    object: Stripe.Invoice
  }
  request: Stripe.Event.Request
}

export type InvoiceOverdueWebhookEvent = {
  type: 'invoice.overdue'
  data: {
    object: Stripe.Invoice
  }
  request: Stripe.Event.Request
}

export type CheckoutSessionCompletedWebhookEvent = {
  type: 'checkout.session.completed'
  data: {
    object: Stripe.Checkout.Session & {
      metadata: {
        userId?: string
      }
    }
  }
  request: Stripe.Event.Request
}

export type CustomerCreatedWebhookEvent = {
  type: 'customer.created'
  data: {
    object: Stripe.Customer
  }
}

export type CustomerSubscriptionWebhookEvent =
  | CustomerSubscriptionUpdatedWebhookEvent
  | CustomerSubscriptionCreatedWebhookEvent
  | CustomerSubscriptionsDeletedWebhookEvent

export type WebhookEvent =
  | CustomerSubscriptionWebhookEvent
  | InvoicePaidWebhookEvent
  | InvoiceVoidedWebhookEvent
  | PaymentIntentPaymentFailedWebhookEvent
  | SetupIntentSetupFailedWebhookEvent
  | SetupIntentSucceededWebhookEvent
  | InvoiceOverdueWebhookEvent
  | CheckoutSessionCompletedWebhookEvent
  | CustomerCreatedWebhookEvent
