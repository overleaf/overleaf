import { Modal } from 'react-bootstrap'
import { useTranslation } from 'react-i18next'
import { SubscriptionDashModalIds } from '../../../../../../../../../../types/subscription/dashboard/modal-ids'
import AccessibleModal from '../../../../../../../../shared/components/accessible-modal'
import LoadingSpinner from '../../../../../../../../shared/components/loading-spinner'
import { useSubscriptionDashboardContext } from '../../../../../../context/subscription-dashboard-context'
import { ChangeToGroupPlan } from '../change-to-group-plan'
import { IndividualPlansTable } from '../individual-plans-table'

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
        <div className="table-outlined-container">
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
    <AccessibleModal id={modalId} show animation onHide={handleCloseModal}>
      <Modal.Header closeButton>
        <Modal.Title>{t('change_plan')}</Modal.Title>
      </Modal.Header>

      <Modal.Body>
        <ChangePlanOptions />
      </Modal.Body>
    </AccessibleModal>
  )
}
