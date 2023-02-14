import { useState } from 'react'
import countries from '../../../../js/features/subscription/data/countries'
import CountrySelectComponent from '../../../../js/features/subscription/components/new/checkout/country-select'
import { PaymentProvider } from '../helpers/context-provider'
import { PaymentContextValue } from '../../../../js/features/subscription/context/types/payment-context-value'

type Args = Pick<
  React.ComponentProps<typeof CountrySelectComponent>,
  'errorFields'
>

const Template = ({ errorFields }: Args) => {
  const [value, setValue] = useState<typeof countries[number]['code']>('GB')
  const providerValue = {
    updateCountry: () => {},
  } as unknown as PaymentContextValue

  return (
    <PaymentProvider value={providerValue}>
      <CountrySelectComponent
        errorFields={errorFields}
        value={value}
        onChange={e =>
          setValue(e.target.value as typeof countries[number]['code'])
        }
      />
    </PaymentProvider>
  )
}

export const CountrySelectDefault = Template.bind({}) as typeof Template & {
  args: Args
}
CountrySelectDefault.args = {
  errorFields: {
    country: false,
  },
}

export const CountrySelectError = Template.bind({}) as typeof Template & {
  args: Args
}
CountrySelectError.args = {
  errorFields: {
    country: true,
  },
}

export default {
  title: 'Subscription / New / Checkout / Form Fields',
  component: CountrySelectComponent,
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
