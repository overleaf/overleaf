import { Meta, StoryObj } from '@storybook/react'
import { DeprecatedBrowser } from '@/shared/components/deprecated-browser'

const meta: Meta = {
  title: 'Project List / Deprecated Browser',
  component: DeprecatedBrowser,
}

export default meta

type Story = StoryObj<typeof DeprecatedBrowser>

export const Notification: Story = {}
