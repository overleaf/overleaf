import { ScopeDecorator } from './decorators/scope'
import { FeedbackBadge } from '@/shared/components/feedback-badge'
import { bsVersionDecorator } from '../../.storybook/utils/with-bootstrap-switcher'

export const WithDefaultText = () => {
  return (
    <FeedbackBadge
      url="https://example.com"
      id="storybook-feedback-with-text"
    />
  )
}

export const WithCustomText = () => {
  const FeedbackContent = () => (
    <>
      This is an example.
      <br />
      Click to find out more
    </>
  )

  return (
    <FeedbackBadge
      url="https://example.com"
      id="storybook-feedback-with-text"
      text={<FeedbackContent />}
    />
  )
}

export default {
  title: 'Shared / Components / Feedback Badge',
  component: FeedbackBadge,
  decorators: [ScopeDecorator],
  argTypes: {
    ...bsVersionDecorator.argTypes,
  },
}
