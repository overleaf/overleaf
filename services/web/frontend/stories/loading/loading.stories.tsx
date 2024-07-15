import type { Meta, StoryObj } from '@storybook/react'
import { Loading } from '@/features/ide-react/components/loading'
import { EditorProviders } from '../../../test/frontend/helpers/editor-providers'

const meta: Meta<typeof Loading> = {
  title: 'Loading Page / Loading',
  component: Loading,
  argTypes: {
    setLoaded: { action: 'setLoaded' },
  },
}

export default meta

type Story = StoryObj<typeof Loading>

export const LoadingPage: Story = {
  render: args => (
    <EditorProviders>
      <Loading {...args} />
    </EditorProviders>
  ),
}
