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
import { useFeatureFlag } from '@/shared/context/split-test-context'

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
  const themed = useFeatureFlag('themed-modals')

  return (
    <OLModal {...modalProps} themed={themed}>
      <OLModalHeader>
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
