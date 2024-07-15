import type { Meta, StoryObj } from '@storybook/react'
import { LoadingError } from '@/features/ide-react/components/loading-error'

const meta: Meta<typeof LoadingError> = {
  title: 'Loading Page / Loading Error',
  component: LoadingError,
}

export default meta

type Story = StoryObj<typeof LoadingError>

export const IoNotLoaded: Story = {
  render: () => {
    window.metaAttributesCache.set(
      'ol-translationIoNotLoaded',
      'Could not connect to the WebSocket server'
    )

    return <LoadingError connectionStateError="io-not-loaded" />
  },
}

export const UnableToJoin: Story = {
  render: () => {
    window.metaAttributesCache.set(
      'ol-translationUnableToJoin',
      'Could not connect to the collaboration server'
    )

    return <LoadingError connectionStateError="unable-to-join" />
  },
}
