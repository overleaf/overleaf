import useFetchMock from '../hooks/use-fetch-mock'
import SettingsPageRoot from '../../js/features/settings/components/root'
import {
  setDefaultMeta as setDefaultLeaveMeta,
  defaultSetupMocks as defaultSetupLeaveMocks,
} from './helpers/leave'
import {
  setDefaultMeta as setDefaultAccountInfoMeta,
  defaultSetupMocks as defaultSetupAccountInfoMocks,
} from './helpers/account-info'
import {
  setDefaultMeta as setDefaultPasswordMeta,
  defaultSetupMocks as defaultSetupPasswordMocks,
} from './helpers/password'
import {
  setDefaultMeta as setDefaultEmailsMeta,
  defaultSetupMocks as defaultSetupEmailsMocks,
} from './helpers/emails'
import {
  setDefaultMeta as setDefaultLinkingMeta,
  defaultSetupMocks as defaultSetupLinkingMocks,
  setPersonalAccessTokensMeta,
} from './helpers/linking'
import { UserProvider } from '../../js/shared/context/user-context'
import { ScopeDecorator } from '../decorators/scope'
import getMeta from '@/utils/meta'

export const Overleaf = args => {
  setDefaultLeaveMeta()
  setDefaultAccountInfoMeta()
  setDefaultPasswordMeta()
  setDefaultEmailsMeta()
  setDefaultLinkingMeta()
  useFetchMock(fetchMock => {
    defaultSetupLeaveMocks(fetchMock)
    defaultSetupAccountInfoMocks(fetchMock)
    defaultSetupPasswordMocks(fetchMock)
    defaultSetupEmailsMocks(fetchMock)
    defaultSetupLinkingMocks(fetchMock)
  })

  return (
    <UserProvider>
      <SettingsPageRoot {...args} />
    </UserProvider>
  )
}

export const OverleafWithAccessTokens = args => {
  setPersonalAccessTokensMeta()
  return Overleaf(args)
}

export const ServerPro = args => {
  setDefaultAccountInfoMeta()
  setDefaultPasswordMeta()
  setPersonalAccessTokensMeta()
  useFetchMock(fetchMock => {
    defaultSetupAccountInfoMocks(fetchMock)
    defaultSetupPasswordMocks(fetchMock)
  })

  Object.assign(getMeta('ol-ExposedSettings'), {
    hasAffiliationsFeature: false,
    isOverleaf: false,
  })
  window.metaAttributesCache.set('ol-hideLinkingWidgets', true)
  window.metaAttributesCache.delete('ol-oauthProviders')

  return (
    <UserProvider>
      <SettingsPageRoot {...args} />
    </UserProvider>
  )
}

export default {
  title: 'Account Settings / Full Page',
  component: SettingsPageRoot,
  decorators: [ScopeDecorator],
}
