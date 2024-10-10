import INRBanner from '@/features/project-list/components/notifications/ads/inr-banner'
import { bsVersionDecorator } from '../../../.storybook/utils/with-bootstrap-switcher'

export const Default = () => {
  return <INRBanner />
}

export default {
  title: 'Project List / INR Banner',
  component: INRBanner,
  argTypes: {
    ...bsVersionDecorator.argTypes,
  },
}
