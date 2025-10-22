import {
  PaypalPaymentMethod,
  CreditCardPaymentMethod,
} from './PaymentProviderEntities.mjs'

export type PaymentMethod = PaypalPaymentMethod | CreditCardPaymentMethod
