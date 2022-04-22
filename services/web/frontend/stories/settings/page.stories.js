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
  setDefaultMeta as setDefaultIntegrationLinkingMeta,
  defaultSetupMocks as defaultSetupIntegrationLinkingMocks,
} from './helpers/integration-linking'
import {
  setDefaultMeta as setDefaultSSOMeta,
  defaultSetupMocks as defaultSetupSSOMocks,
} from './helpers/sso-linking'
import { UserProvider } from '../../js/shared/context/user-context'

export const Root = args => {
  setDefaultLeaveMeta()
  setDefaultAccountInfoMeta()
  setDefaultPasswordMeta()
  setDefaultEmailsMeta()
  setDefaultIntegrationLinkingMeta()
  setDefaultSSOMeta()
  useFetchMock(defaultSetupLeaveMocks)
  useFetchMock(defaultSetupAccountInfoMocks)
  useFetchMock(defaultSetupPasswordMocks)
  useFetchMock(defaultSetupEmailsMocks)
  useFetchMock(defaultSetupIntegrationLinkingMocks)
  useFetchMock(defaultSetupSSOMocks)

  return (
    <UserProvider>
      <SettingsPageRoot {...args} />
    </UserProvider>
  )
}

export default {
  title: 'Account Settings / Full Page',
  component: SettingsPageRoot,
}
