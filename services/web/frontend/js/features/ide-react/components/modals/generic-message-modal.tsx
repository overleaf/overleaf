import { useTranslation } from 'react-i18next'
import { memo } from 'react'
import OLModal, {
  OLModalBody,
  OLModalFooter,
  OLModalHeader,
  OLModalTitle,
} from '@/features/ui/components/ol/ol-modal'
import OLButton from '@/features/ui/components/ol/ol-button'

export type GenericMessageModalOwnProps = {
  title: string
  message: string
}

type GenericMessageModalProps = React.ComponentProps<typeof OLModal> &
  GenericMessageModalOwnProps

function GenericMessageModal({
  title,
  message,
  ...modalProps
}: GenericMessageModalProps) {
  const { t } = useTranslation()

  return (
    <OLModal {...modalProps}>
      <OLModalHeader closeButton>
        <OLModalTitle>{title}</OLModalTitle>
      </OLModalHeader>

      <OLModalBody className="modal-body-share">{message}</OLModalBody>

      <OLModalFooter>
        <OLButton variant="secondary" onClick={() => modalProps.onHide()}>
          {t('ok')}
        </OLButton>
      </OLModalFooter>
    </OLModal>
  )
}

export default memo(GenericMessageModal)
