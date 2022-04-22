import EmailsSection from '../../js/features/settings/components/emails-section'
import useFetchMock from './../hooks/use-fetch-mock'
import {
  setDefaultMeta,
  defaultSetupMocks,
  errorsMocks,
} from './helpers/emails'

export const EmailsList = args => {
  useFetchMock(defaultSetupMocks)
  setDefaultMeta()

  return <EmailsSection {...args} />
}

export const NetworkErrors = args => {
  useFetchMock(errorsMocks)
  setDefaultMeta()

  return <EmailsSection {...args} />
}

export default {
  title: 'Account Settings / Emails and Affiliations',
  component: EmailsSection,
}
