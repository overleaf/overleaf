import EmailsSection from '../../js/features/settings/components/emails-section'
import { LeaversSurveyAlert } from '../../js/features/settings/components/leavers-survey-alert'

export const SurveyAlert = () => {
  localStorage.setItem(
    'showInstitutionalLeaversSurveyUntil',
    (Date.now() + 1000 * 60 * 60).toString()
  )
  return <LeaversSurveyAlert />
}

export default {
  title: 'Account Settings / Survey Alerts',
  component: EmailsSection,
}
