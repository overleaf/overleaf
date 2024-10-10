import useFetchMock from '../hooks/use-fetch-mock'
import AccountInfoSection from '../../js/features/settings/components/account-info-section'
import { setDefaultMeta, defaultSetupMocks } from './helpers/account-info'
import { UserProvider } from '../../js/shared/context/user-context'
import getMeta from '@/utils/meta'
import { bsVersionDecorator } from '../../../.storybook/utils/with-bootstrap-switcher'

export const Success = args => {
  setDefaultMeta()
  useFetchMock(defaultSetupMocks)

  return (
    <UserProvider>
      <AccountInfoSection {...args} />
    </UserProvider>
  )
}

export const ReadOnly = args => {
  setDefaultMeta()
  window.metaAttributesCache.set('ol-isExternalAuthenticationSystemUsed', true)
  window.metaAttributesCache.set('ol-shouldAllowEditingDetails', false)

  return (
    <UserProvider>
      <AccountInfoSection {...args} />
    </UserProvider>
  )
}

export const NoEmailInput = args => {
  setDefaultMeta()
  Object.assign(getMeta('ol-ExposedSettings'), {
    hasAffiliationsFeature: true,
  })
  useFetchMock(defaultSetupMocks)

  return (
    <UserProvider>
      <AccountInfoSection {...args} />
    </UserProvider>
  )
}

export const Error = args => {
  setDefaultMeta()
  useFetchMock(fetchMock => fetchMock.post(/\/user\/settings/, 500))

  return (
    <UserProvider>
      <AccountInfoSection {...args} />
    </UserProvider>
  )
}

export default {
  title: 'Account Settings / Account Info',
  component: AccountInfoSection,
  argTypes: {
    ...bsVersionDecorator.argTypes,
  },
}
