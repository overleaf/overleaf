import { useState } from 'react'
import LastNameComponent from '../../../../js/features/subscription/components/new/checkout/last-name'

type Args = Pick<React.ComponentProps<typeof LastNameComponent>, 'errorFields'>

const Template = ({ errorFields }: Args) => {
  const [value, setValue] = useState('')

  return (
    <LastNameComponent
      errorFields={errorFields}
      value={value}
      onChange={e => setValue(e.target.value)}
    />
  )
}

export const LastNameDefault = Template.bind({}) as typeof Template & {
  args: Args
}
LastNameDefault.args = {
  errorFields: {
    last_name: false,
  },
}

export const LastNameError = Template.bind({}) as typeof Template & {
  args: Args
}
LastNameError.args = {
  errorFields: {
    last_name: true,
  },
}

export default {
  title: 'Subscription / New / Checkout / Form Fields',
  component: LastNameComponent,
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
