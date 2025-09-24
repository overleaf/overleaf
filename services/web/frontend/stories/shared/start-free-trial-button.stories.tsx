import type { Meta, StoryObj } from '@storybook/react'
import StartFreeTrialButton from '../../js/shared/components/start-free-trial-button'
import type { ButtonProps } from '../../js/shared/components/types/button-props'

type Args = React.ComponentProps<typeof StartFreeTrialButton> & {
  size?: ButtonProps['size']
}

type Story = StoryObj<Args>

export const Default: Story = {
  render: args => {
    const { size, ...startFreeTrialProps } = args
    return (
      <StartFreeTrialButton {...startFreeTrialProps} buttonProps={{ size }} />
    )
  },
}

export const CustomText: Story = {
  render: args => {
    const { size, ...startFreeTrialProps } = args
    return (
      <StartFreeTrialButton {...startFreeTrialProps} buttonProps={{ size }}>
        Some Custom Text!
      </StartFreeTrialButton>
    )
  },
}

export const ButtonStyle: Story = {
  render: args => {
    const { size: _size, ...startFreeTrialProps } = args
    return (
      <StartFreeTrialButton
        {...startFreeTrialProps}
        buttonProps={{
          variant: 'secondary',
          size: 'lg',
        }}
      />
    )
  },
}

const meta: Meta<Args> = {
  title: 'Shared / Components / Start Free Trial Button',
  component: StartFreeTrialButton,
  parameters: {
    controls: {
      include: ['source', 'variant', 'children', 'size'],
    },
  },
  argTypes: {
    source: { control: 'text' },
    buttonProps: { control: false },
    children: { control: 'text' },
    size: {
      control: 'radio',
      options: ['lg', 'md', 'sm'],
    },
    variant: {
      control: 'radio',
      options: [
        'primary',
        'secondary',
        'ghost',
        'danger',
        'danger-ghost',
        'premium',
        'premium-secondary',
        'link',
      ],
    },
    handleClick: { control: false },
    segmentation: { control: false },
    extraSearchParams: { control: false },
  },
  args: {
    source: 'storybook',
    variant: 'secondary',
    size: undefined,
  },
}

export default meta
