import Stripe from 'stripe'

type StripeSubscription = Stripe.Subscription & {
  metadata: {
    billing_migration_id?: string
    recurly_to_stripe_migration_status?: 'in_progress' | 'completed'
  }
  customer: string
}

export interface CustomerSubscriptionUpdatedWebhookEvent
  extends Stripe.EventBase {
  type: 'customer.subscription.updated'
  data: {
    object: StripeSubscription
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
    object: StripeSubscription
  }
}

export interface CustomerSubscriptionsDeletedWebhookEvent
  extends Stripe.EventBase {
  type: 'customer.subscription.deleted'
  data: {
    object: StripeSubscription
  }
}

export interface InvoicePaidWebhookEvent extends Stripe.EventBase {
  type: 'invoice.paid'
  data: {
    object: Stripe.Invoice & {
      parent: Stripe.Invoice.Parent & {
        subscription_details: Stripe.Invoice.Parent.SubscriptionDetails & {
          metadata: {
            billing_migration_id?: string
            recurly_to_stripe_migration_status?: 'in_progress' | 'completed'
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

export interface CustomerCreatedWebhookEvent extends Stripe.EventBase {
  type: 'customer.created'
  data: {
    object: Stripe.Customer
  }
}

export interface CustomerUpdatedWebhookEvent extends Stripe.EventBase {
  type: 'customer.updated'
  data: {
    object: Stripe.Customer
    previous_attributes?: {
      invoice_settings?: {
        default_payment_method?: string
      }
      address?: Stripe.Address
      name?: string
      email?: string
    }
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
  | InvoiceOverdueWebhookEvent
  | CustomerCreatedWebhookEvent
  | CustomerUpdatedWebhookEvent
