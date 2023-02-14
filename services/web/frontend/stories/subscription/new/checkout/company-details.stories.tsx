import { useState } from 'react'
import CompanyDetailsComponent from '../../../../js/features/subscription/components/new/checkout/company-details'
import { PaymentProvider } from '../helpers/context-provider'
import {
  PaymentContextValue,
  PricingFormState,
} from '../../../../js/features/subscription/context/types/payment-context-value'

type Args = Pick<
  React.ComponentProps<typeof CompanyDetailsComponent>,
  'taxesCount'
>

export const CompanyDetails = (args: Args) => {
  const [pricingFormState, setPricingFormState] = useState<PricingFormState>({
    first_name: '',
    last_name: '',
    postal_code: '',
    address1: '',
    address2: '',
    state: '',
    city: '',
    company: '',
    vat_number: '',
    country: 'GB',
    coupon: '',
  })

  const providerValue = {
    applyVatNumber: () => {},
    pricingFormState,
    setPricingFormState,
  } as unknown as PaymentContextValue

  return (
    <PaymentProvider value={providerValue}>
      <CompanyDetailsComponent {...args} />
    </PaymentProvider>
  )
}

export default {
  title: 'Subscription / New / Checkout / Form Fields',
  component: CompanyDetailsComponent,
  argTypes: {
    taxesCount: {
      control: {
        type: 'number',
      },
    },
  },
  args: {
    taxesCount: 1,
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
