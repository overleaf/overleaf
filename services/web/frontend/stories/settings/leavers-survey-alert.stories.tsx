import EmailsSection from '../../js/features/settings/components/emails-section'
import { UserEmailsProvider } from '../../js/features/settings/context/user-email-context'
import { LeaversSurveyAlert } from '../../js/features/settings/components/leavers-survey-alert'
import localStorage from '@/infrastructure/local-storage'
import { bsVersionDecorator } from '../../../.storybook/utils/with-bootstrap-switcher'

export const SurveyAlert = () => {
  localStorage.setItem(
    'showInstitutionalLeaversSurveyUntil',
    Date.now() + 1000 * 60 * 60
  )
  return (
    <UserEmailsProvider>
      <LeaversSurveyAlert />
    </UserEmailsProvider>
  )
}

export default {
  title: 'Account Settings / Survey Alerts',
  component: EmailsSection,
  argTypes: {
    ...bsVersionDecorator.argTypes,
  },
}
