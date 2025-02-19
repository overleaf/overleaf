import { Meta, StoryObj } from '@storybook/react'
import { UnsavedDocsLockedAlert } from '@/features/ide-react/components/unsaved-docs/unsaved-docs-locked-alert'
import { ScopeDecorator } from '../decorators/scope'
import { bsVersionDecorator } from '../../../.storybook/utils/with-bootstrap-switcher'

export default {
  title: 'Editor / Modals / Unsaved Docs Locked',
  component: UnsavedDocsLockedAlert,
  decorators: [Story => ScopeDecorator(Story)],
  argTypes: {
    ...bsVersionDecorator.argTypes,
  },
  parameters: {
    bootstrap5: true,
  },
} satisfies Meta

type Story = StoryObj<typeof UnsavedDocsLockedAlert>

export const Locked: Story = {}
