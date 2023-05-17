import importOverleafModules from '../macros/import-overleaf-module.macro'
import { ScopeDecorator } from './decorators/scope'
import GitBridgeModalTokens from '../../modules/git-bridge/frontend/js/components/git-bridge-modal-tokens'
import useFetchMock from './hooks/use-fetch-mock'

const [
  {
    import: { default: GitBridgeModal },
  },
] = importOverleafModules('gitBridge')

function renderModal(args, newModal = false) {
  window.metaAttributesCache = new Map()
  window.metaAttributesCache.set('ol-showPersonalAccessToken', newModal)
  window.metaAttributesCache.set('ol-personalAccessTokens', [])
  return <GitBridgeModal {...args} />
}

export const GitBridgeUrlModal = args => renderModal(args)
GitBridgeUrlModal.args = {
  type: 'show_url',
}

export const CollaboratorModal = args => renderModal(args)
CollaboratorModal.args = {
  type: 'collaborator',
}

export const TeaserModal = args => {
  // TODO: mock navigator.sendBeacon?
  // useFetchMock(fetchMock => {
  //   fetchMock.post('express:/event/:key', 202)
  // })

  return renderModal(args)
}
TeaserModal.args = {
  type: 'teaser',
}

export const AccessTokensWithNoTokens = args => {
  useFetchMock(fetchMock =>
    fetchMock.get('/oauth/personal-access-tokens', [], { delay: 500 })
  )
  useFetchMock(fetchMock =>
    fetchMock.post(
      '/oauth/personal-access-tokens',
      {
        accessToken: 'olp_2fvP3amgiJRJk2JWP6nxZqGHKRVwMvcgo9mk',
      },
      { delay: 1000 }
    )
  )
  return renderModal(args, true)
}

export const AccessTokensWithTokens = args => {
  useFetchMock(fetchMock =>
    fetchMock.get('/oauth/personal-access-tokens', [{}], { delay: 500 })
  )
  return <GitBridgeModalTokens {...args} />
}

export const AccessTokensGetTokensError = args => {
  useFetchMock(fetchMock =>
    fetchMock.get(
      '/oauth/personal-access-tokens',
      { status: 403 },
      { delay: 1000 }
    )
  )
  return <GitBridgeModalTokens {...args} />
}

export const AccessTokensCreateTokensError = args => {
  useFetchMock(fetchMock => fetchMock.get('/oauth/personal-access-tokens', []))
  useFetchMock(fetchMock =>
    fetchMock.post(
      '/oauth/personal-access-tokens',
      { status: 403 },
      { delay: 1000 }
    )
  )
  return <GitBridgeModalTokens {...args} />
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
