import EmailsSection from '../../js/features/settings/components/emails-section'
import useFetchMock from './../hooks/use-fetch-mock'
import {
  setDefaultMeta,
  setReconfirmationMeta,
  defaultSetupMocks,
  reconfirmationSetupMocks,
  errorsMocks,
  emailLimitSetupMocks,
} from './helpers/emails'
import { bsVersionDecorator } from '../../../.storybook/utils/with-bootstrap-switcher'

export const EmailsList = args => {
  useFetchMock(defaultSetupMocks)
  setDefaultMeta()

  return <EmailsSection {...args} />
}

export const EmailLimitList = args => {
  useFetchMock(emailLimitSetupMocks)
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
  argTypes: {
    ...bsVersionDecorator.argTypes,
  },
}
