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
import { useFeatureFlag } from '@/shared/context/split-test-context'

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
  const themed = useFeatureFlag('themed-modals')

  return (
    <OLModal show={show} onHide={onHide} themed={themed}>
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
