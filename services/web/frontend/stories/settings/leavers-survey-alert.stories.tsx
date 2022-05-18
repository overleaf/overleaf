import EmailsSection from '../../js/features/settings/components/emails-section'
import { LeaversSurveyAlert } from '../../js/features/settings/components/leavers-survey-alert'
import localStorage from '../../js/infrastructure/local-storage'

export const SurveyAlert = () => {
  localStorage.setItem(
    'showInstitutionalLeaversSurveyUntil',
    Date.now() + 1000 * 60 * 60
  )
  return <LeaversSurveyAlert />
}

export default {
  title: 'Account Settings / Survey Alerts',
  component: EmailsSection,
}
