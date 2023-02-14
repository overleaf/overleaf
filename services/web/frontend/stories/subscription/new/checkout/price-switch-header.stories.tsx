import PriceSwitchHeaderComponent from '../../../../js/features/subscription/components/new/checkout/price-switch-header'

type Args = React.ComponentProps<typeof PriceSwitchHeaderComponent>

export const PriceSwitchHeader = (args: Args) => (
  <PriceSwitchHeaderComponent {...args} />
)

const options = {
  current: 'fake_plan',
  other: 'fake_plan_new',
}

export default {
  title: 'Subscription / New / Checkout',
  component: PriceSwitchHeaderComponent,
  argTypes: {
    planCode: {
      options: Object.values(options),
      control: {
        type: 'select',
        labels: Object.entries(options).reduce(
          (prev, [key, value]) => ({ ...prev, [String(value)]: key }),
          {}
        ),
      },
    },
  },
  args: {
    planCode: 'fake_plan',
    planCodes: ['fake_plan'],
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
