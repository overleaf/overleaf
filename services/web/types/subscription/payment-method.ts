// Payment methods selectable in the checkout UI
export type PaymentMethod = 'card' | 'paypal' | 'apple_pay' | 'google_pay'

// Server-side analytics segmentation passes through the raw Stripe payment
// method type for methods not in the checkout UI (e.g. sepa_debit)
export type AnalyticsPaymentMethod = PaymentMethod | (string & {})
