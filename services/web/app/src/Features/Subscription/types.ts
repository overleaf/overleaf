import {
  PaypalPaymentMethod,
  CreditCardPaymentMethod,
} from './PaymentProviderEntities'

export type PaymentMethod = PaypalPaymentMethod | CreditCardPaymentMethod
