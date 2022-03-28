import { ContextRoot } from '../js/shared/context/root-context'
import { setupContext } from './fixtures/context'
import importOverleafModules from '../macros/import-overleaf-module.macro'
import useFetchMock from './hooks/use-fetch-mock'

const [
  {
    import: { default: GitBridgeModal },
  },
] = importOverleafModules('gitBridge')

setupContext()

export const GitBridgeUrlModal = args => <GitBridgeModal {...args} />
GitBridgeUrlModal.args = {
  type: 'show_url',
}

export const CollaboratorModal = args => <GitBridgeModal {...args} />
CollaboratorModal.args = {
  type: 'collaborator',
}

export const TeaserModal = args => {
  useFetchMock(fetchMock => fetchMock.post('express:/event/:key', 202))

  return <GitBridgeModal {...args} />
}
TeaserModal.args = {
  type: 'teaser',
}

export default {
  title: 'Editor / Modals / Git Bridge',
  component: GitBridgeModal,
  args: {
    show: true,
  },
  argTypes: {
    handleHide: { action: 'handleHide' },
  },
  decorators: [
    Story => (
      <>
        <ContextRoot ide={window._ide} settings={{}}>
          <Story />
        </ContextRoot>
      </>
    ),
  ],
}
