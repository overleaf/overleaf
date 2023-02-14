import { useState } from 'react'
import PaymentMethodToggleComponent from '../../../../js/features/subscription/components/new/checkout/payment-method-toggle'

export const PaymentMethodToggle = () => {
  const [paymentMethod, setPaymentMethod] = useState('credit_card')

  return (
    <PaymentMethodToggleComponent
      paymentMethod={paymentMethod}
      onChange={e => setPaymentMethod(e.target.value)}
    />
  )
}

export default {
  title: 'Subscription / New / Checkout',
  component: PaymentMethodToggleComponent,
  decorators: [
    (Story: React.ComponentType) => (
      <div
        className="card card-highlighted card-border"
        style={{ maxWidth: '500px' }}
      >
        <Story />
      </div>
    ),
  ],
}
