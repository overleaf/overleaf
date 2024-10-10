import SessionsSection from '../../js/features/settings/components/sessions-section'
import { bsVersionDecorator } from '../../../.storybook/utils/with-bootstrap-switcher'

export const Section = args => {
  return <SessionsSection {...args} />
}

export default {
  title: 'Account Settings / Sessions',
  component: SessionsSection,
  argTypes: {
    ...bsVersionDecorator.argTypes,
  },
}
