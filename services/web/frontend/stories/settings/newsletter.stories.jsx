import NewsletterSection from '../../js/features/settings/components/newsletter-section'
import { bsVersionDecorator } from '../../../.storybook/utils/with-bootstrap-switcher'

export const Section = args => {
  return <NewsletterSection {...args} />
}

export default {
  title: 'Account Settings / Newsletter',
  component: NewsletterSection,
  argTypes: {
    ...bsVersionDecorator.argTypes,
  },
}
