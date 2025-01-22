import type { Meta, StoryObj } from '@storybook/react'
import { LoadingUI } from '@/features/ide-react/components/loading'
import { EditorProviders } from '../../../test/frontend/helpers/editor-providers'
import { bsVersionDecorator } from '../../../.storybook/utils/with-bootstrap-switcher'
import { PartialMeta } from '@/utils/meta'

const meta: Meta<typeof LoadingUI> = {
  title: 'Loading Page / Loading',
  component: LoadingUI,
  argTypes: {
    errorCode: {
      control: 'select',
      options: [
        '',
        'io-not-loaded',
        'unable-to-join',
        'i18n-error',
        'unhandled-error-code',
      ],
    },
    progress: { control: { type: 'range', min: 0, max: 100 } },
    ...bsVersionDecorator.argTypes,
  },
}

export default meta

type Story = StoryObj<typeof LoadingUI>

const errorMessages = {
  translationIoNotLoaded: 'Could not connect to the WebSocket server',
  translationLoadErrorMessage: 'Could not load translations',
  translationUnableToJoin: 'Could not connect to collaboration server',
}

export const LoadingPage: Story = {
  render: args => {
    for (const [key, value] of Object.entries(errorMessages)) {
      window.metaAttributesCache.set(`ol-${key}` as keyof PartialMeta, value)
    }
    return (
      <EditorProviders>
        <LoadingUI {...args} />
      </EditorProviders>
    )
  },
}
