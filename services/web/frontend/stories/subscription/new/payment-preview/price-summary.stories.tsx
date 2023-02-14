import PriceSummaryComponent from '../../../../js/features/subscription/components/new/payment-preview/price-summary'
import { PaymentProvider } from '../helpers/context-provider'

type Args = Pick<React.ComponentProps<typeof PaymentProvider>, 'value'>

export const PriceSummary = (args: Args) => {
  return (
    <PaymentProvider value={args.value}>
      <PriceSummaryComponent />
    </PaymentProvider>
  )
}

export default {
  title: 'Subscription / New / Payment Preview',
  component: PriceSummaryComponent,
  args: {
    value: {
      currencyCode: 'USD',
      currencySymbol: '$',
      coupon: {
        name: 'react',
        normalPriceWithoutTax: 15,
      },
      changeCurrency: (_eventKey: string) => {},
      limitedCurrencies: {
        USD: '$',
        EUR: '€',
      },
      monthlyBilling: true,
      planName: 'Test plan',
      recurlyPrice: {
        discount: '3',
        tax: '5.00',
        total: '10.00',
      },
      taxes: [
        {
          rate: '1',
        },
      ],
    },
  },
  decorators: [
    (Story: React.ComponentType) => (
      <div style={{ maxWidth: '300px' }}>
        <Story />
      </div>
    ),
  ],
}
