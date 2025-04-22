import { useTranslation } from 'react-i18next'
import { SubscriptionDashModalIds } from '../../../../../../../../../../types/subscription/dashboard/modal-ids'
import { useSubscriptionDashboardContext } from '../../../../../../context/subscription-dashboard-context'
import OLModal, {
  OLModalBody,
  OLModalFooter,
  OLModalHeader,
  OLModalTitle,
} from '@/features/ui/components/ol/ol-modal'
import OLButton from '@/features/ui/components/ol/ol-button'

export function WritefullBundleManagementModal() {
  const modalId: SubscriptionDashModalIds = 'manage-on-writefull'
  const { t } = useTranslation()
  const { handleCloseModal, modalIdShown } = useSubscriptionDashboardContext()

  if (modalIdShown !== modalId) return null

  return (
    <OLModal
      id={modalId}
      show
      animation
      onHide={handleCloseModal}
      backdrop="static"
    >
      <OLModalHeader>
        <OLModalTitle>{t('manage_your_ai_assist_add_on')}</OLModalTitle>
      </OLModalHeader>

      <OLModalBody>
        <p>{t('ai_assist_in_overleaf_is_included_via_writefull')}</p>
      </OLModalBody>

      <OLModalFooter>
        <OLButton variant="secondary" onClick={handleCloseModal}>
          {t('back')}
        </OLButton>
        <OLButton
          variant="primary"
          onClick={handleCloseModal}
          href="https://my.writefull.com/account"
          target="_blank"
          rel="noreferrer"
        >
          {t('go_to_writefull')}
        </OLButton>
      </OLModalFooter>
    </OLModal>
  )
}
