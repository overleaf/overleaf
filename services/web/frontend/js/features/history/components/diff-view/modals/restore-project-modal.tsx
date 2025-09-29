import {
  OLModal,
  OLModalBody,
  OLModalFooter,
  OLModalHeader,
  OLModalTitle,
} from '@/shared/components/ol/ol-modal'
import { formatDate } from '@/utils/dates'
import { useCallback } from 'react'
import OLButton from '@/shared/components/ol/ol-button'
import { useTranslation } from 'react-i18next'

type RestoreProjectModalProps = {
  setShow: React.Dispatch<React.SetStateAction<boolean>>
  show: boolean
  isRestoring: boolean
  endTimestamp: number
  onRestore: () => void
}

export const RestoreProjectModal = ({
  setShow,
  show,
  endTimestamp,
  isRestoring,
  onRestore,
}: RestoreProjectModalProps) => {
  const { t } = useTranslation()

  const onCancel = useCallback(() => {
    setShow(false)
  }, [setShow])

  return (
    <OLModal onHide={() => setShow(false)} show={show}>
      <OLModalHeader>
        <OLModalTitle>{t('restore_this_version')}</OLModalTitle>
      </OLModalHeader>
      <OLModalBody>
        <p>
          {t('your_current_project_will_revert_to_the_version_from_time', {
            timestamp: formatDate(endTimestamp),
          })}
        </p>
      </OLModalBody>
      <OLModalFooter>
        <OLButton variant="secondary" onClick={onCancel} disabled={isRestoring}>
          {t('cancel')}
        </OLButton>
        <OLButton
          variant="primary"
          onClick={onRestore}
          disabled={isRestoring}
          isLoading={isRestoring}
          loadingLabel={t('restoring')}
        >
          {t('restore')}
        </OLButton>
      </OLModalFooter>
    </OLModal>
  )
}
