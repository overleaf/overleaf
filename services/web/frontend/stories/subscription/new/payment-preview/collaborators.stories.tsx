import CollaboratorsComponent from '../../../../js/features/subscription/components/new/payment-preview/collaborators'

type Args = React.ComponentProps<typeof CollaboratorsComponent>

export const Collaborators = (args: Args) => (
  <CollaboratorsComponent {...args} />
)

const options = {
  unlimited: -1,
  single: 1,
  multiple: 2,
}

export default {
  title: 'Subscription / New / Payment Preview',
  component: CollaboratorsComponent,
  argTypes: {
    count: {
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
    count: options.single, // default
  },
  decorators: [
    (Story: React.ComponentType) => (
      <div style={{ maxWidth: '300px' }}>
        <Story />
      </div>
    ),
  ],
}
