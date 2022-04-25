import useFetchMock from '../hooks/use-fetch-mock'
import LinkingSection from '../../js/features/settings/components/linking-section'
import { setDefaultMeta, defaultSetupMocks } from './helpers/linking'
import { UserProvider } from '../../js/shared/context/user-context'
import { SSOProvider } from '../../js/features/settings/context/sso-context'

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
  setDefaultMeta()
  window.metaAttributesCache.set('ol-thirdPartyIds', {})
  window.metaAttributesCache.set('ol-user', {
    features: { github: true, dropbox: true, mendeley: true, zotero: true },
    refProviders: {
      mendeley: false,
      zotero: false,
    },
  })
  window.metaAttributesCache.set('ol-github', { enabled: false })
  window.metaAttributesCache.set('ol-dropbox', { registered: false })

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
}
