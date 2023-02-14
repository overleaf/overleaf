import { useState } from 'react'
import AddressSecondLineComponent from '../../../../js/features/subscription/components/new/checkout/address-second-line'

type Args = Pick<
  React.ComponentProps<typeof AddressSecondLineComponent>,
  'errorFields'
>

const Template = ({ errorFields }: Args) => {
  const [value, setValue] = useState('')

  return (
    <AddressSecondLineComponent
      errorFields={errorFields}
      value={value}
      onChange={e => setValue(e.target.value)}
    />
  )
}

export const AddressSecondLineDefault = Template.bind({}) as typeof Template & {
  args: Args
}
AddressSecondLineDefault.args = {
  errorFields: {
    address2: false,
  },
}

export const AddressSecondLineError = Template.bind({}) as typeof Template & {
  args: Args
}
AddressSecondLineError.args = {
  errorFields: {
    address2: true,
  },
}

export default {
  title: 'Subscription / New / Checkout / Form Fields',
  component: AddressSecondLineComponent,
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
