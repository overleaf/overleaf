import { useState } from 'react'
import { useTranslation, Trans } from 'react-i18next'
import { SubscriptionDashModalIds } from '../../../../../../../../../../types/subscription/dashboard/modal-ids'
import { postJSON } from '../../../../../../../../infrastructure/fetch-json'
import { useSubscriptionDashboardContext } from '../../../../../../context/subscription-dashboard-context'
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
import {
  AI_ADD_ON_CODE,
  ADD_ON_NAME,
  isStandaloneAiPlanCode,
} from '../../../../../../data/add-on-codes'
import {
  cancelSubscriptionUrl,
  redirectAfterCancelSubscriptionUrl,
} from '../../../../../../data/subscription-url'

export function CancelAiAddOnModal() {
  const modalId: SubscriptionDashModalIds = 'cancel-ai-add-on'
  const [error, setError] = useState(false)
  const [inflight, setInflight] = useState(false)
  const { t } = useTranslation()
  const { handleCloseModal, modalIdShown, personalSubscription } =
    useSubscriptionDashboardContext()
  const location = useLocation()

  if (!personalSubscription) return null

  const onStandalone = isStandaloneAiPlanCode(personalSubscription.planCode)

  const cancellationEndpoint = onStandalone
    ? cancelSubscriptionUrl
    : `/user/subscription/addon/${AI_ADD_ON_CODE}/remove`

  async function handleConfirmChange() {
    setError(false)
    setInflight(true)

    try {
      await postJSON(cancellationEndpoint)
      location.assign(redirectAfterCancelSubscriptionUrl)
    } catch (e) {
      setError(true)
      setInflight(false)
    }
  }

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
        <OLModalTitle>{t('cancel_add_on')}</OLModalTitle>
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
            i18nKey="are_you_sure_you_want_to_cancel_add_on"
            values={{
              addOnName: ADD_ON_NAME,
            }}
            shouldUnescape
            tOptions={{ interpolation: { escapeValue: true } }}
            components={{ strong: <strong /> }}
          />
        </p>
        <p>{t('the_add_on_will_remain_active_until')}</p>
      </OLModalBody>

      <OLModalFooter>
        <OLButton
          variant="secondary"
          disabled={inflight}
          onClick={handleCloseModal}
        >
          {t('back')}
        </OLButton>
        <OLButton
          variant="danger"
          disabled={inflight}
          isLoading={inflight}
          loadingLabel={t('processing_uppercase') + '…'}
          onClick={handleConfirmChange}
        >
          {t('cancel_add_on')}
        </OLButton>
      </OLModalFooter>
    </OLModal>
  )
}
