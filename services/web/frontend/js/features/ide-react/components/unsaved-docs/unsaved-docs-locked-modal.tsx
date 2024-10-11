import { FC } from 'react'
import { useTranslation } from 'react-i18next'
import OLModal, {
  OLModalBody,
  OLModalHeader,
  OLModalTitle,
} from '@/features/ui/components/ol/ol-modal'

export const UnsavedDocsLockedModal: FC = () => {
  const { t } = useTranslation()

  return (
    <OLModal
      show
      onHide={() => {}} // It's not possible to hide this modal, but it's a required prop
      className="lock-editor-modal"
      backdrop={false}
      keyboard={false}
    >
      <OLModalHeader>
        <OLModalTitle>{t('connection_lost')}</OLModalTitle>
      </OLModalHeader>
      <OLModalBody>
        {t('sorry_the_connection_to_the_server_is_down')}
      </OLModalBody>
    </OLModal>
  )
}
