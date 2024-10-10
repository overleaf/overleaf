import StartFreeTrialButton from '../js/shared/components/start-free-trial-button'
import { ScopeDecorator } from './decorators/scope'
import { bsVersionDecorator } from '../../.storybook/utils/with-bootstrap-switcher'

export const Default = args => {
  return <StartFreeTrialButton {...args} />
}

export const CustomText = args => {
  return (
    <StartFreeTrialButton {...args}>Some Custom Text!</StartFreeTrialButton>
  )
}

export const ButtonStyle = args => {
  return (
    <StartFreeTrialButton
      {...args}
      buttonProps={{
        variant: 'danger',
        size: 'lg',
      }}
    />
  )
}

export default {
  title: 'Shared / Components / Start Free Trial Button',
  component: StartFreeTrialButton,
  args: {
    source: 'storybook',
  },
  decorators: [ScopeDecorator],
  argTypes: {
    ...bsVersionDecorator.argTypes,
  },
}
