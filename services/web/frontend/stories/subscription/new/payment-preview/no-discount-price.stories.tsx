import NoDiscountPriceComponent from '../../../../js/features/subscription/components/new/payment-preview/no-discount-price'
import { PaymentProvider } from '../helpers/context-provider'
import { PaymentContextValue } from '../../../../js/features/subscription/context/types/payment-context-value'

type Args = Pick<React.ComponentProps<typeof PaymentProvider>, 'value'>

const Template = (args: Args) => {
  return (
    <PaymentProvider value={args.value}>
      <NoDiscountPriceComponent />
    </PaymentProvider>
  )
}

const commonValues = {
  currencySymbol: '$',
  coupon: {
    normalPrice: 2,
  },
}

export const ThenXPricePerMonth = Template.bind({}) as typeof Template & {
  args: Args
}
const thenXPricePerMonthValue = {
  ...commonValues,
  monthlyBilling: true,
  coupon: {
    ...commonValues.coupon,
    discountMonths: 2,
    singleUse: false,
  },
} as PaymentContextValue
ThenXPricePerMonth.args = {
  value: thenXPricePerMonthValue,
}

export const ThenXPricePerYear = Template.bind({}) as typeof Template & {
  args: Args
}
const thenXPricePerYearValue = {
  ...commonValues,
  monthlyBilling: false,
  coupon: {
    ...commonValues.coupon,
    singleUse: true,
  },
} as PaymentContextValue
ThenXPricePerYear.args = {
  value: thenXPricePerYearValue,
}

export const NormallyXPricePerMonth = Template.bind({}) as typeof Template & {
  args: Args
}
const normallyXPricePerMonthValue = {
  ...commonValues,
  monthlyBilling: true,
  coupon: {
    ...commonValues.coupon,
    singleUse: false,
  },
} as PaymentContextValue
NormallyXPricePerMonth.args = {
  value: normallyXPricePerMonthValue,
}

export const NormallyXPricePerYear = Template.bind({}) as typeof Template & {
  args: Args
}
const normallyXPricePerYearValue = {
  ...commonValues,
  monthlyBilling: false,
  coupon: {
    ...commonValues.coupon,
    singleUse: false,
  },
} as PaymentContextValue
NormallyXPricePerYear.args = {
  value: normallyXPricePerYearValue,
}

export default {
  title: 'Subscription / New / Payment Preview / No Discount Price',
  component: NoDiscountPriceComponent,
  decorators: [
    (Story: React.ComponentType) => (
      <div style={{ maxWidth: '300px' }}>
        <Story />
      </div>
    ),
  ],
}
