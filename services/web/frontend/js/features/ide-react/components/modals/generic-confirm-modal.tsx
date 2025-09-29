import { useTranslation } from 'react-i18next'
import { memo } from 'react'
import {
  OLModal,
  OLModalBody,
  OLModalFooter,
  OLModalHeader,
  OLModalTitle,
} from '@/shared/components/ol/ol-modal'
import OLButton from '@/shared/components/ol/ol-button'
import { ButtonProps } from '@/shared/components/types/button-props'

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
  onConfirm,
  ...modalProps
}: GenericConfirmModalProps) {
  const { t } = useTranslation()

  return (
    <OLModal {...modalProps}>
      <OLModalHeader>
        <OLModalTitle>{title}</OLModalTitle>
      </OLModalHeader>

      <OLModalBody className="modal-generic-confirm">{message}</OLModalBody>

      <OLModalFooter>
        <OLButton variant="secondary" onClick={() => modalProps.onHide()}>
          {t('cancel')}
        </OLButton>
        <OLButton variant={primaryVariant} onClick={onConfirm}>
          {confirmLabel || t('ok')}
        </OLButton>
      </OLModalFooter>
    </OLModal>
  )
}

export default memo(GenericConfirmModal)
