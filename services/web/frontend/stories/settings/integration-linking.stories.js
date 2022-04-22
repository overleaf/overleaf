import useFetchMock from '../hooks/use-fetch-mock'
import IntegrationLinkingSection from '../../js/features/settings/components/integration-linking-section'
import {
  setDefaultMeta,
  defaultSetupMocks,
} from './helpers/integration-linking'
import { UserProvider } from '../../js/shared/context/user-context'

export const Section = args => {
  useFetchMock(defaultSetupMocks)
  setDefaultMeta()

  return (
    <UserProvider>
      <IntegrationLinkingSection {...args} />
    </UserProvider>
  )
}

export default {
  title: 'Account Settings / Integration Linking / Section',
  component: IntegrationLinkingSection,
}
