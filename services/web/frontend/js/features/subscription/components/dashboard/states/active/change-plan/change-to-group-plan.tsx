import { useTranslation } from 'react-i18next'
import { useSubscriptionDashboardContext } from '../../../../../context/subscription-dashboard-context'
import OLButton from '@/features/ui/components/ol/ol-button'

export function ChangeToGroupPlan() {
  const { t } = useTranslation()
  const { handleOpenModal } = useSubscriptionDashboardContext()

  const handleClick = () => {
    handleOpenModal('change-to-group')
  }

  return (
    <div className="card-gray text-center mt-3 p-3">
      <h2 style={{ marginTop: 0 }}>{t('looking_multiple_licenses')}</h2>
      <p style={{ margin: 0 }}>{t('reduce_costs_group_licenses')}</p>
      <br />
      <OLButton variant="primary" onClick={handleClick}>
        {t('change_to_group_plan')}
      </OLButton>
    </div>
  )
}
