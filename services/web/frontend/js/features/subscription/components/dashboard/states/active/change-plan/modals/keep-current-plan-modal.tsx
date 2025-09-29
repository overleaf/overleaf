import { useState } from 'react'
import { useTranslation, Trans } from 'react-i18next'
import { SubscriptionDashModalIds } from '../../../../../../../../../../types/subscription/dashboard/modal-ids'
import { postJSON } from '../../../../../../../../infrastructure/fetch-json'
import { useSubscriptionDashboardContext } from '../../../../../../context/subscription-dashboard-context'
import { cancelPendingSubscriptionChangeUrl } from '../../../../../../data/subscription-url'
import { useLocation } from '../../../../../../../../shared/hooks/use-location'
import {
  OLModal,
  OLModalBody,
  OLModalFooter,
  OLModalHeader,
  OLModalTitle,
} from '@/shared/components/ol/ol-modal'
import OLButton from '@/shared/components/ol/ol-button'
import OLNotification from '@/shared/components/ol/ol-notification'

export function KeepCurrentPlanModal() {
  const modalId: SubscriptionDashModalIds = 'keep-current-plan'
  const [error, setError] = useState(false)
  const [inflight, setInflight] = useState(false)
  const { t } = useTranslation()
  const location = useLocation()
  const { modalIdShown, handleCloseModal, personalSubscription } =
    useSubscriptionDashboardContext()

  async function confirmCancelPendingPlanChange() {
    setError(false)
    setInflight(true)

    try {
      await postJSON(cancelPendingSubscriptionChangeUrl)
      location.reload()
    } catch (e) {
      setError(true)
      setInflight(false)
    }
  }

  if (modalIdShown !== modalId || !personalSubscription) return null

  return (
    <OLModal
      id={modalId}
      show
      animation
      onHide={handleCloseModal}
      backdrop="static"
    >
      <OLModalHeader>
        <OLModalTitle>{t('change_plan')}</OLModalTitle>
      </OLModalHeader>

      <OLModalBody>
        {error && (
          <OLNotification
            type="error"
            aria-live="polite"
            content={
              <>
                {t('generic_something_went_wrong')}. {t('try_again')}.{' '}
                {t('generic_if_problem_continues_contact_us')}.
              </>
            }
          />
        )}
        <p>
          <Trans
            i18nKey="sure_you_want_to_cancel_plan_change"
            values={{
              planName: personalSubscription.plan.name,
            }}
            shouldUnescape
            tOptions={{ interpolation: { escapeValue: true } }}
            components={[
              // eslint-disable-next-line react/jsx-key
              <strong />,
            ]}
          />
        </p>
      </OLModalBody>

      <OLModalFooter>
        <OLButton
          variant="secondary"
          disabled={inflight}
          onClick={handleCloseModal}
        >
          {t('cancel')}
        </OLButton>
        <OLButton
          variant="primary"
          disabled={inflight}
          isLoading={inflight}
          loadingLabel={t('processing_uppercase') + '…'}
          onClick={confirmCancelPendingPlanChange}
        >
          {t('revert_pending_plan_change')}
        </OLButton>
      </OLModalFooter>
    </OLModal>
  )
}
