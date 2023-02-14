import { useState } from 'react'
import PostalCodeComponent from '../../../../js/features/subscription/components/new/checkout/postal-code'

type Args = Pick<
  React.ComponentProps<typeof PostalCodeComponent>,
  'errorFields'
>

const Template = ({ errorFields }: Args) => {
  const [value, setValue] = useState('')

  return (
    <PostalCodeComponent
      errorFields={errorFields}
      value={value}
      onChange={e => setValue(e.target.value)}
    />
  )
}

export const PostalCodeDefault = Template.bind({}) as typeof Template & {
  args: Args
}
PostalCodeDefault.args = {
  errorFields: {
    postal_code: false,
  },
}

export const PostalCodeError = Template.bind({}) as typeof Template & {
  args: Args
}
PostalCodeError.args = {
  errorFields: {
    postal_code: true,
  },
}

export default {
  title: 'Subscription / New / Checkout / Form Fields',
  component: PostalCodeComponent,
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
