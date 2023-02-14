import FeaturesListComponent from '../../../../js/features/subscription/components/new/payment-preview/features-list'
import { Plan } from '../../../../../types/subscription/plan'

type Args = React.ComponentProps<typeof FeaturesListComponent>

export const FeaturesList = (args: Args) => <FeaturesListComponent {...args} />

const features = {
  compileTimeout: 2,
  dropbox: true,
  github: true,
  versioning: true,
  trackChanges: true,
  references: true,
  mendeley: true,
  zotero: true,
  symbolPalette: true,
} as unknown as Plan['features']

export default {
  title: 'Subscription / New / Payment Preview',
  component: FeaturesListComponent,
  args: {
    features,
  },
  decorators: [
    (Story: React.ComponentType) => (
      <div style={{ maxWidth: '300px' }}>
        <Story />
      </div>
    ),
  ],
}
