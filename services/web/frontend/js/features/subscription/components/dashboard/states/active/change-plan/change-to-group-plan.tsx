import { useTranslation } from 'react-i18next'
import { useSubscriptionDashboardContext } from '../../../../../context/subscription-dashboard-context'

export function ChangeToGroupPlan() {
  const { t } = useTranslation()
  const { handleOpenModal } = useSubscriptionDashboardContext()

  const handleClick = () => {
    handleOpenModal('change-to-group')
  }

  return (
    <>
      <h2>{t('looking_multiple_licenses')}</h2>
      <p style={{ margin: 0 }}>{t('reduce_costs_group_licenses')}</p>
      <br />
      <button className="btn btn-primary" onClick={handleClick}>
        {t('change_to_group_plan')}
      </button>
    </>
  )
}
