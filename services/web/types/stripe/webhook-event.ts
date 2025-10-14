import Stripe from 'stripe'

export interface CustomerSubscriptionUpdatedWebhookEvent
  extends Stripe.EventBase {
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

export interface CustomerSubscriptionCreatedWebhookEvent
  extends Stripe.EventBase {
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

export interface CustomerSubscriptionsDeletedWebhookEvent
  extends Stripe.EventBase {
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

export interface InvoicePaidWebhookEvent extends Stripe.EventBase {
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
}

export interface PaymentIntentPaymentFailedWebhookEvent
  extends Stripe.EventBase {
  type: 'payment_intent.payment_failed'
  data: {
    object: Stripe.PaymentIntent
  }
  request: Stripe.Event.Request
}

export interface SetupIntentSetupFailedWebhookEvent extends Stripe.EventBase {
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
}

export interface SetupIntentSucceededWebhookEvent extends Stripe.EventBase {
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
}

export interface InvoiceVoidedWebhookEvent extends Stripe.EventBase {
  type: 'invoice.voided'
  data: {
    object: Stripe.Invoice
  }
}

export interface InvoiceOverdueWebhookEvent extends Stripe.EventBase {
  type: 'invoice.overdue'
  data: {
    object: Stripe.Invoice
  }
}

export interface CheckoutSessionCompletedWebhookEvent extends Stripe.EventBase {
  type: 'checkout.session.completed'
  data: {
    object: Stripe.Checkout.Session & {
      metadata: {
        userId?: string
      }
    }
  }
}

export interface CustomerCreatedWebhookEvent extends Stripe.EventBase {
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
