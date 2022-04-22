import useFetchMock from '../hooks/use-fetch-mock'
import AccountInfoSection from '../../js/features/settings/components/account-info-section'
import { setDefaultMeta, defaultSetupMocks } from './helpers/account-info'

export const Success = args => {
  setDefaultMeta()
  useFetchMock(defaultSetupMocks)

  return <AccountInfoSection {...args} />
}

export const ReadOnly = args => {
  setDefaultMeta()
  window.metaAttributesCache.set('ol-isExternalAuthenticationSystemUsed', true)
  window.metaAttributesCache.set('ol-shouldAllowEditingDetails', false)

  return <AccountInfoSection {...args} />
}

export const NoEmailInput = args => {
  setDefaultMeta()
  window.metaAttributesCache.set('ol-ExposedSettings', {
    hasAffiliationsFeature: true,
  })
  useFetchMock(defaultSetupMocks)

  return <AccountInfoSection {...args} />
}

export const Error = args => {
  setDefaultMeta()
  useFetchMock(fetchMock => fetchMock.post(/\/user\/settings/, 500))

  return <AccountInfoSection {...args} />
}

export default {
  title: 'Account Settings / Account Info',
  component: AccountInfoSection,
}
