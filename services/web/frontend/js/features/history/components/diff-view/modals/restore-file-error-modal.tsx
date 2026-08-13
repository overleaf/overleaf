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

export function RestoreFileErrorModal({
  resetErrorBoundary,
}: {
  resetErrorBoundary: VoidFunction
}) {
  const { t } = useTranslation()
  const themed = useFeatureFlag('themed-modals')

  return (
    <OLModal show onHide={resetErrorBoundary} themed={themed}>
      <OLModalHeader>
        <OLModalTitle>{t('restore_file_error_title')}</OLModalTitle>
      </OLModalHeader>
      <OLModalBody>{t('restore_file_error_message')}</OLModalBody>
      <OLModalFooter>
        <OLButton variant="secondary" onClick={resetErrorBoundary}>
          {t('close')}
        </OLButton>
      </OLModalFooter>
    </OLModal>
  )
}
