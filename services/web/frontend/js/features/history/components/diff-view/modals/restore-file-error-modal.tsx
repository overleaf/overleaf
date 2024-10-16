import OLModal, {
  OLModalBody,
  OLModalFooter,
  OLModalHeader,
  OLModalTitle,
} from '@/features/ui/components/ol/ol-modal'
import OLButton from '@/features/ui/components/ol/ol-button'
import { useTranslation } from 'react-i18next'

export function RestoreFileErrorModal({
  resetErrorBoundary,
}: {
  resetErrorBoundary: VoidFunction
}) {
  const { t } = useTranslation()

  return (
    <OLModal show onHide={resetErrorBoundary}>
      <OLModalHeader closeButton>
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
