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

export function RestoreProjectErrorModal({
  resetErrorBoundary,
}: {
  resetErrorBoundary: VoidFunction
}) {
  const { t } = useTranslation()
  const themed = useFeatureFlag('themed-modals')

  return (
    <OLModal show onHide={resetErrorBoundary} themed={themed}>
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
