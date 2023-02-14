import PriceForFirstXPeriod from '../../../../js/features/subscription/components/new/payment-preview/price-for-first-x-period'
import { PaymentProvider } from '../helpers/context-provider'
import { PaymentContextValue } from '../../../../js/features/subscription/context/types/payment-context-value'

type Args = Pick<React.ComponentProps<typeof PaymentProvider>, 'value'>

const Template = (args: Args) => {
  return (
    <PaymentProvider value={args.value}>
      <PriceForFirstXPeriod />
    </PaymentProvider>
  )
}

const commonValues = {
  currencySymbol: '$',
  recurlyPrice: {
    total: '10.00',
  },
}

export const XPriceForYMonths = Template.bind({}) as typeof Template & {
  args: Args
}
const xPriceForYMonthsValue = {
  ...commonValues,
  monthlyBilling: true,
  coupon: {
    discountMonths: 2,
    singleUse: false,
  },
} as PaymentContextValue
XPriceForYMonths.args = {
  value: xPriceForYMonthsValue,
}

export const XPriceForFirstMonth = Template.bind({}) as typeof Template & {
  args: Args
}
const xPriceForFirstMonthValue = {
  ...commonValues,
  monthlyBilling: true,
  coupon: {
    singleUse: true,
  },
} as PaymentContextValue
XPriceForFirstMonth.args = {
  value: xPriceForFirstMonthValue,
}

export const XPriceForFirstYear = Template.bind({}) as typeof Template & {
  args: Args
}
const xPriceForFirstYearValue = {
  ...commonValues,
  monthlyBilling: false,
  coupon: {
    singleUse: true,
  },
} as PaymentContextValue
XPriceForFirstYear.args = {
  value: xPriceForFirstYearValue,
}

export default {
  title: 'Subscription / New / Payment Preview / Price For First X Period',
  component: PriceForFirstXPeriod,
  decorators: [
    (Story: React.ComponentType) => (
      <div style={{ maxWidth: '300px' }}>
        <Story />
      </div>
    ),
  ],
}
