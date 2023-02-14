import TrialPriceComponent from '../../../../js/features/subscription/components/new/payment-preview/trial-price'
import { PaymentProvider } from '../helpers/context-provider'

type Args = Pick<React.ComponentProps<typeof PaymentProvider>, 'value'>

export const TrialPrice = (args: Args) => {
  return (
    <PaymentProvider value={args.value}>
      <TrialPriceComponent />
    </PaymentProvider>
  )
}

export default {
  title: 'Subscription / New / Payment Preview',
  component: TrialPriceComponent,
  args: {
    value: {
      currencySymbol: '$',
      recurlyPrice: {
        total: '10.00',
      },
      trialLength: 7,
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
