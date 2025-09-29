import OLButton from '@/shared/components/ol/ol-button'
import {
  OLModal,
  OLModalBody,
  OLModalFooter,
  OLModalHeader,
  OLModalTitle,
} from '@/shared/components/ol/ol-modal'
import Notification from '@/shared/components/notification'
import { useTranslation } from 'react-i18next'

type LeaveProjectModalProps = {
  showModal: boolean
  handleCloseModal: () => void
  handleLeaveAction: () => void
}
function LeaveProjectModal({
  showModal,
  handleCloseModal,
  handleLeaveAction,
}: LeaveProjectModalProps) {
  const { t } = useTranslation()

  return (
    <OLModal
      animation
      show={showModal}
      onHide={handleCloseModal}
      id="action-project-modal"
      backdrop="static"
    >
      <OLModalHeader>
        <OLModalTitle>{t('leave_project')}</OLModalTitle>
      </OLModalHeader>
      <OLModalBody>
        <p>{t('about_to_leave_project')}</p>
        <Notification
          content={t('this_action_cannot_be_undone')}
          type="warning"
        />
      </OLModalBody>
      <OLModalFooter>
        <OLButton variant="secondary" onClick={handleCloseModal}>
          {t('cancel')}
        </OLButton>
        <OLButton variant="danger" onClick={() => handleLeaveAction()}>
          {t('confirm')}
        </OLButton>
      </OLModalFooter>
    </OLModal>
  )
}

export default LeaveProjectModal
