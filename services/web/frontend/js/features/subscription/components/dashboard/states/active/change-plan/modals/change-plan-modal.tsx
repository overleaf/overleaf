import { useTranslation } from 'react-i18next'
import { SubscriptionDashModalIds } from '../../../../../../../../../../types/subscription/dashboard/modal-ids'
import LoadingSpinner from '../../../../../../../../shared/components/loading-spinner'
import { useSubscriptionDashboardContext } from '../../../../../../context/subscription-dashboard-context'
import { ChangeToGroupPlan } from '../change-to-group-plan'
import { IndividualPlansTable } from '../individual-plans-table'
import OLModal, {
  OLModalBody,
  OLModalHeader,
  OLModalTitle,
} from '@/features/ui/components/ol/ol-modal'

function ChangePlanOptions() {
  const { plans, queryingIndividualPlansData, recurlyLoadError } =
    useSubscriptionDashboardContext()

  if (!plans || recurlyLoadError) return null

  if (queryingIndividualPlansData) {
    return (
      <>
        <LoadingSpinner />
      </>
    )
  } else {
    return (
      <>
        <div className="border rounded px-2 pt-1 table-outlined-container">
          <IndividualPlansTable plans={plans} />
        </div>
        <ChangeToGroupPlan />
      </>
    )
  }
}

export function ChangePlanModal() {
  const modalId: SubscriptionDashModalIds = 'change-plan'
  const { t } = useTranslation()
  const { handleCloseModal, modalIdShown } = useSubscriptionDashboardContext()

  if (modalIdShown !== modalId) return null

  return (
    <OLModal id={modalId} show animation onHide={handleCloseModal} size="lg">
      <OLModalHeader closeButton>
        <OLModalTitle>{t('change_plan')}</OLModalTitle>
      </OLModalHeader>

      <OLModalBody>
        <ChangePlanOptions />
      </OLModalBody>
    </OLModal>
  )
}
