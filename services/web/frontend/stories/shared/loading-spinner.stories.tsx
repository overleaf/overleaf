import type { Meta, StoryObj } from '@storybook/react'
import LoadingSpinner, {
  FullSizeLoadingSpinner,
} from '@/shared/components/loading-spinner'

type Story = StoryObj<typeof LoadingSpinner>

export const Default: Story = {
  args: {
    loadingText: 'Loading content...',
  },
}

export const WithDelay: Story = {
  args: {
    delay: 500,
    loadingText: 'This will appear after a 500ms delay...',
  },
}

export const FullSize: StoryObj<typeof FullSizeLoadingSpinner> = {
  render: args => <FullSizeLoadingSpinner {...args} />,
  args: {
    loadingText: 'Loading entire section...',
    size: 'sm',
  },
}

const meta: Meta<typeof LoadingSpinner> = {
  title: 'Shared / Components / Loading Spinner',
  component: LoadingSpinner,
  parameters: {
    layout: 'centered',
    controls: {
      include: ['loadingText', 'delay', 'size'],
    },
  },
  argTypes: {
    delay: {
      control: 'select',
      options: [0, 500],
    },
    size: {
      control: 'radio',
      options: ['lg', 'sm'],
    },
  },
  args: {
    size: 'sm',
    delay: 0,
  },
  render: args => <LoadingSpinner {...args} />,
}

export default meta
