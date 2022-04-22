import useFetchMock from '../hooks/use-fetch-mock'
import SSOLinkingSection from '../../js/features/settings/components/sso-linking-section'
import { setDefaultMeta, defaultSetupMocks } from './helpers/sso-linking'

export const Section = args => {
  useFetchMock(defaultSetupMocks)
  setDefaultMeta()

  return <SSOLinkingSection {...args} />
}

export const SectionAllUnlinked = args => {
  useFetchMock(defaultSetupMocks)
  setDefaultMeta()
  window.metaAttributesCache.set('ol-thirdPartyIds', {})

  return <SSOLinkingSection {...args} />
}

export default {
  title: 'Account Settings / SSO Linking / Section',
  component: SSOLinkingSection,
}
