import importOverleafModules from '../macros/import-overleaf-module.macro'
import { ScopeDecorator } from './decorators/scope'

const [
  {
    import: { default: GitBridgeModal },
  },
] = importOverleafModules('gitBridge')

export const GitBridgeUrlModal = args => <GitBridgeModal {...args} />
GitBridgeUrlModal.args = {
  type: 'show_url',
}

export const CollaboratorModal = args => <GitBridgeModal {...args} />
CollaboratorModal.args = {
  type: 'collaborator',
}

export const TeaserModal = args => {
  // TODO: mock navigator.sendBeacon?
  // useFetchMock(fetchMock => {
  //   fetchMock.post('express:/event/:key', 202)
  // })

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
  decorators: [ScopeDecorator],
}
