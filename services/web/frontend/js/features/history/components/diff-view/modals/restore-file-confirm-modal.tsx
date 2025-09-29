import { formatTime } from '@/features/utils/format-date'
import { useMemo } from 'react'
import {
  OLModal,
  OLModalBody,
  OLModalFooter,
  OLModalHeader,
  OLModalTitle,
} from '@/shared/components/ol/ol-modal'
import OLButton from '@/shared/components/ol/ol-button'
import { useTranslation } from 'react-i18next'

type RestoreFileConfirmModalProps = {
  show: boolean
  timestamp: number
  onConfirm: () => void
  onHide: () => void
}

export function RestoreFileConfirmModal({
  show,
  timestamp,
  onConfirm,
  onHide,
}: RestoreFileConfirmModalProps) {
  const { t } = useTranslation()
  const date = useMemo(() => formatTime(timestamp, 'Do MMMM'), [timestamp])
  const time = useMemo(() => formatTime(timestamp, 'h:mm a'), [timestamp])

  return (
    <OLModal show={show} onHide={onHide}>
      <OLModalHeader>
        <OLModalTitle>{t('restore_file_confirmation_title')}</OLModalTitle>
      </OLModalHeader>
      <OLModalBody>
        {t('restore_file_confirmation_message', { date, time })}
      </OLModalBody>
      <OLModalFooter>
        <OLButton variant="secondary" onClick={onHide}>
          {t('cancel')}
        </OLButton>
        <OLButton variant="primary" onClick={onConfirm}>
          {t('restore')}
        </OLButton>
      </OLModalFooter>
    </OLModal>
  )
}
