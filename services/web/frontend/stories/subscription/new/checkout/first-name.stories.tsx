import { useState } from 'react'
import FirstNameComponent from '../../../../js/features/subscription/components/new/checkout/first-name'

type Args = Pick<React.ComponentProps<typeof FirstNameComponent>, 'errorFields'>

const Template = ({ errorFields }: Args) => {
  const [value, setValue] = useState('')

  return (
    <FirstNameComponent
      errorFields={errorFields}
      value={value}
      onChange={e => setValue(e.target.value)}
    />
  )
}

export const FirstNameDefault = Template.bind({}) as typeof Template & {
  args: Args
}
FirstNameDefault.args = {
  errorFields: {
    first_name: false,
  },
}

export const FirstNameError = Template.bind({}) as typeof Template & {
  args: Args
}
FirstNameError.args = {
  errorFields: {
    first_name: true,
  },
}

export default {
  title: 'Subscription / New / Checkout / Form Fields',
  component: FirstNameComponent,
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
