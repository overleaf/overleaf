import { useCallback, useState } from 'react'
import { Button, Modal } from 'react-bootstrap'
import { useTranslation } from 'react-i18next'
import { deleteJSON } from '../../../../infrastructure/fetch-json'
import AccessibleModal from '../../../../shared/components/accessible-modal'
import { useSubscriptionDashboardContext } from '../../context/subscription-dashboard-context'
import { useLocation } from '../../../../shared/hooks/use-location'

export const LEAVE_GROUP_MODAL_ID = 'leave-group'

export default function LeaveGroupModal() {
  const { t } = useTranslation()
  const { handleCloseModal, modalIdShown, leavingGroupId } =
    useSubscriptionDashboardContext()
  const [inflight, setInflight] = useState(false)
  const location = useLocation()

  const handleConfirmLeaveGroup = useCallback(async () => {
    if (!leavingGroupId) {
      return
    }
    setInflight(true)
    try {
      const params = new URLSearchParams()
      params.set('subscriptionId', leavingGroupId)
      await deleteJSON(`/subscription/group/user?${params}`)
      location.reload()
    } catch (error) {
      console.log('something went wrong', error)
      setInflight(false)
    }
  }, [location, leavingGroupId])

  if (modalIdShown !== LEAVE_GROUP_MODAL_ID || !leavingGroupId) {
    return null
  }

  return (
    <AccessibleModal
      id={LEAVE_GROUP_MODAL_ID}
      show
      animation
      onHide={handleCloseModal}
      backdrop="static"
    >
      <Modal.Header>
        <Modal.Title>{t('leave_group')}</Modal.Title>
      </Modal.Header>

      <Modal.Body>
        <p>{t('sure_you_want_to_leave_group')}</p>
      </Modal.Body>

      <Modal.Footer>
        <Button
          bsStyle={null}
          className="btn-secondary"
          onClick={handleCloseModal}
          disabled={inflight}
        >
          {t('cancel')}
        </Button>
        <Button
          bsStyle="danger"
          onClick={handleConfirmLeaveGroup}
          disabled={inflight}
        >
          {inflight ? t('processing_uppercase') + '…' : t('leave_now')}
        </Button>
      </Modal.Footer>
    </AccessibleModal>
  )
}
