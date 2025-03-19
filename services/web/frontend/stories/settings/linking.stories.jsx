import useFetchMock from '../hooks/use-fetch-mock'
import LinkingSection from '../../js/features/settings/components/linking-section'
import { setDefaultMeta, defaultSetupMocks } from './helpers/linking'
import { UserProvider } from '../../js/shared/context/user-context'
import { SSOProvider } from '../../js/features/settings/context/sso-context'
import { ScopeDecorator } from '../decorators/scope'
import { useEffect } from 'react'
import { useMeta } from '../hooks/use-meta'

const MOCK_DELAY = 1000

export const Section = args => {
  useFetchMock(defaultSetupMocks)
  setDefaultMeta()

  return (
    <UserProvider>
      <SSOProvider>
        <LinkingSection {...args} />
      </SSOProvider>
    </UserProvider>
  )
}

export const SectionAllUnlinked = args => {
  useFetchMock(defaultSetupMocks)

  useMeta({
    'ol-thirdPartyIds': {},
    'ol-user': {
      features: { github: true, dropbox: true, mendeley: true, zotero: true },
      refProviders: {
        mendeley: false,
        zotero: false,
      },
    },
    'ol-github': { enabled: false },
    'ol-dropbox': { registered: false },
  })

  useEffect(() => {
    setDefaultMeta()
  }, [])

  return (
    <UserProvider>
      <SSOProvider>
        <LinkingSection {...args} />
      </SSOProvider>
    </UserProvider>
  )
}

export const SectionSSOErrors = args => {
  useFetchMock(fetchMock =>
    fetchMock.post('/user/oauth-unlink', 500, { delay: MOCK_DELAY })
  )
  setDefaultMeta()
  window.metaAttributesCache.set('ol-hideLinkingWidgets', true)
  window.metaAttributesCache.set(
    'ol-ssoErrorMessage',
    'Account already linked to another Overleaf user'
  )

  return (
    <UserProvider>
      <SSOProvider>
        <LinkingSection {...args} />
      </SSOProvider>
    </UserProvider>
  )
}

export const SectionProjetSyncSuccess = args => {
  useFetchMock(defaultSetupMocks)
  setDefaultMeta()
  window.metaAttributesCache.set('ol-github', { enabled: true })
  window.metaAttributesCache.set(
    'ol-projectSyncSuccessMessage',
    'Thanks, we’ve successfully linked your GitHub account to Overleaf. You can now export your Overleaf projects to GitHub, or import projects from your GitHub repositories.'
  )

  return (
    <UserProvider>
      <SSOProvider>
        <LinkingSection {...args} />
      </SSOProvider>
    </UserProvider>
  )
}

export default {
  title: 'Account Settings / Linking',
  component: LinkingSection,
  decorators: [ScopeDecorator],
}
