import { useState } from 'react'
import AddressFirstLineComponent from '../../../../js/features/subscription/components/new/checkout/address-first-line'

type Args = Pick<
  React.ComponentProps<typeof AddressFirstLineComponent>,
  'errorFields'
>

const Template = ({ errorFields }: Args) => {
  const [value, setValue] = useState('')

  return (
    <AddressFirstLineComponent
      errorFields={errorFields}
      value={value}
      onChange={e => setValue(e.target.value)}
    />
  )
}

export const AddressFirstLineDefault = Template.bind({}) as typeof Template & {
  args: Args
}
AddressFirstLineDefault.args = {
  errorFields: {
    address1: false,
  },
}

export const AddressFirstLineError = Template.bind({}) as typeof Template & {
  args: Args
}
AddressFirstLineError.args = {
  errorFields: {
    address1: true,
  },
}

export default {
  title: 'Subscription / New / Checkout / Form Fields',
  component: AddressFirstLineComponent,
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
