import EmailsSection from '../../js/features/settings/components/emails-section'
import useFetchMock from './../hooks/use-fetch-mock'
import {
  setDefaultMeta,
  setReconfirmationMeta,
  defaultSetupMocks,
  reconfirmationSetupMocks,
  errorsMocks,
} from './helpers/emails'

export const EmailsList = args => {
  useFetchMock(defaultSetupMocks)
  setDefaultMeta()

  return <EmailsSection {...args} />
}

export const ReconfirmationEmailsList = args => {
  useFetchMock(reconfirmationSetupMocks)
  setReconfirmationMeta()

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
