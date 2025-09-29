import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { deleteJSON } from '../../../../infrastructure/fetch-json'
import { useSubscriptionDashboardContext } from '../../context/subscription-dashboard-context'
import { useLocation } from '../../../../shared/hooks/use-location'
import { debugConsole } from '@/utils/debugging'
import {
  OLModal,
  OLModalBody,
  OLModalFooter,
  OLModalHeader,
  OLModalTitle,
} from '@/shared/components/ol/ol-modal'
import OLButton from '@/shared/components/ol/ol-button'

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
      debugConsole.error('something went wrong', error)
      setInflight(false)
    }
  }, [location, leavingGroupId])

  if (modalIdShown !== LEAVE_GROUP_MODAL_ID || !leavingGroupId) {
    return null
  }

  return (
    <OLModal
      id={LEAVE_GROUP_MODAL_ID}
      show
      animation
      onHide={handleCloseModal}
      backdrop="static"
    >
      <OLModalHeader>
        <OLModalTitle>{t('leave_group')}</OLModalTitle>
      </OLModalHeader>

      <OLModalBody>
        <p>{t('sure_you_want_to_leave_group')}</p>
      </OLModalBody>

      <OLModalFooter>
        <OLButton
          variant="secondary"
          onClick={handleCloseModal}
          disabled={inflight}
        >
          {t('cancel')}
        </OLButton>
        <OLButton
          variant="danger"
          onClick={handleConfirmLeaveGroup}
          disabled={inflight}
          isLoading={inflight}
          loadingLabel={t('processing_uppercase') + '…'}
        >
          {t('leave_now')}
        </OLButton>
      </OLModalFooter>
    </OLModal>
  )
}
