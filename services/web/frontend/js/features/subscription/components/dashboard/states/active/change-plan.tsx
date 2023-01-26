import { useTranslation } from 'react-i18next'
import { useSubscriptionDashboardContext } from '../../../../context/subscription-dashboard-context'

export function ChangePlan() {
  const { t } = useTranslation()
  const { showChangePersonalPlan } = useSubscriptionDashboardContext()

  if (!showChangePersonalPlan) return null

  return (
    <>
      <h2>{t('change_plan')}</h2>
      <p>
        <strong>TODO: change subscription placeholder</strong>
      </p>
    </>
  )
}
