import { FC } from 'react'
import { Modal } from 'react-bootstrap'
import { useTranslation } from 'react-i18next'
import AccessibleModal from '@/shared/components/accessible-modal'

export const UnsavedDocsLockedModal: FC = () => {
  const { t } = useTranslation()

  return (
    <AccessibleModal
      show
      onHide={() => {}} // It's not possible to hide this modal, but it's a required prop
      className="lock-editor-modal"
      backdrop={false}
      keyboard={false}
    >
      <Modal.Header>
        <Modal.Title>{t('connection_lost')}</Modal.Title>
      </Modal.Header>
      <Modal.Body>{t('sorry_the_connection_to_the_server_is_down')}</Modal.Body>
    </AccessibleModal>
  )
}
