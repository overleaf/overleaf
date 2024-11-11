import { useTranslation } from 'react-i18next'
import { memo } from 'react'
import OLModal, {
  OLModalBody,
  OLModalFooter,
  OLModalHeader,
  OLModalTitle,
} from '@/features/ui/components/ol/ol-modal'
import OLButton from '@/features/ui/components/ol/ol-button'
import { ButtonProps } from '@/features/ui/components/types/button-props'

export type GenericConfirmModalOwnProps = {
  title: string
  message: string
  onConfirm: () => void
  confirmLabel?: string
  primaryVariant?: ButtonProps['variant']
}

type GenericConfirmModalProps = React.ComponentProps<typeof OLModal> &
  GenericConfirmModalOwnProps

function GenericConfirmModal({
  title,
  message,
  confirmLabel,
  primaryVariant = 'primary',
  ...modalProps
}: GenericConfirmModalProps) {
  const { t } = useTranslation()
  const handleConfirmClick = modalProps.onConfirm

  return (
    <OLModal {...modalProps}>
      <OLModalHeader closeButton>
        <OLModalTitle>{title}</OLModalTitle>
      </OLModalHeader>

      <OLModalBody className="modal-generic-confirm">{message}</OLModalBody>

      <OLModalFooter>
        <OLButton variant="secondary" onClick={() => modalProps.onHide()}>
          {t('cancel')}
        </OLButton>
        <OLButton variant={primaryVariant} onClick={handleConfirmClick}>
          {confirmLabel || t('ok')}
        </OLButton>
      </OLModalFooter>
    </OLModal>
  )
}

export default memo(GenericConfirmModal)
