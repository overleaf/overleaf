import {
  OLModal,
  OLModalBody,
  OLModalFooter,
  OLModalHeader,
  OLModalTitle,
} from '@/shared/components/ol/ol-modal'
import OLButton from '@/shared/components/ol/ol-button'
import { useTranslation } from 'react-i18next'

export function RestoreProjectErrorModal({
  resetErrorBoundary,
}: {
  resetErrorBoundary: VoidFunction
}) {
  const { t } = useTranslation()

  return (
    <OLModal show onHide={resetErrorBoundary}>
      <OLModalHeader>
        <OLModalTitle>
          {t('an_error_occured_while_restoring_project')}
        </OLModalTitle>
      </OLModalHeader>
      <OLModalBody>
        {t(
          'there_was_a_problem_restoring_the_project_please_try_again_in_a_few_moments_or_contact_us'
        )}
      </OLModalBody>
      <OLModalFooter>
        <OLButton variant="secondary" onClick={resetErrorBoundary}>
          {t('close')}
        </OLButton>
      </OLModalFooter>
    </OLModal>
  )
}
