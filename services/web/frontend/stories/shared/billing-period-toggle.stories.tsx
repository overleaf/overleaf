import type { Meta, StoryObj } from '@storybook/react'
import { useState } from 'react'
import BillingPeriodToggle, {
  type BillingPeriod,
} from '../../js/shared/components/billing-period-toggle'

type Args = React.ComponentProps<typeof BillingPeriodToggle>

const meta: Meta<Args> = {
  title: 'Subscription / Billing Period Toggle',
  component: BillingPeriodToggle,
  parameters: {
    controls: {
      include: ['value', 'showDiscount', 'variant'],
    },
  },
  argTypes: {
    value: {
      control: 'radio',
      options: ['monthly', 'annual'],
    },
    showDiscount: {
      control: 'boolean',
    },
    variant: {
      control: 'radio',
      options: ['default', 'premium'],
    },
    onChange: { action: 'onChange' },
  },
  args: {
    value: 'monthly',
    showDiscount: true,
    variant: 'default',
  },
}

export default meta

type Story = StoryObj<Args>

const InteractiveToggle = (args: Args) => {
  const [value, setValue] = useState<BillingPeriod>(args.value)
  return (
    <BillingPeriodToggle
      {...args}
      value={value}
      onChange={period => {
        setValue(period)
        args.onChange?.(period)
      }}
    />
  )
}

export const Default: Story = {
  render: InteractiveToggle,
}

export const WithoutDiscount: Story = {
  render: args => <InteractiveToggle {...args} showDiscount={false} />,
}

export const AnnualSelected: Story = {
  args: {
    value: 'annual',
  },
  render: InteractiveToggle,
}

export const PremiumVariant: Story = {
  args: {
    variant: 'premium',
  },
  render: InteractiveToggle,
}

export const PremiumVariantAnnualSelected: Story = {
  args: {
    variant: 'premium',
    value: 'annual',
  },
  render: InteractiveToggle,
}
