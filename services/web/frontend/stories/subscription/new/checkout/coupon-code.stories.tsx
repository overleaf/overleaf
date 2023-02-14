import { useState } from 'react'
import CouponCodeComponent from '../../../../js/features/subscription/components/new/checkout/coupon-code'
import { PaymentProvider } from '../helpers/context-provider'
import { PaymentContextValue } from '../../../../js/features/subscription/context/types/payment-context-value'

export const CouponCode = () => {
  const [value, setValue] = useState('')
  const providerValue = {
    addCoupon: () => {},
  } as unknown as PaymentContextValue

  return (
    <PaymentProvider value={providerValue}>
      <CouponCodeComponent
        value={value}
        onChange={e => setValue(e.target.value)}
      />
    </PaymentProvider>
  )
}

export default {
  title: 'Subscription / New / Checkout / Form Fields',
  component: CouponCodeComponent,
  argTypes: {
    value: {
      table: {
        disable: true,
      },
    },
    onChange: {
      table: {
        disable: true,
      },
    },
  },
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
