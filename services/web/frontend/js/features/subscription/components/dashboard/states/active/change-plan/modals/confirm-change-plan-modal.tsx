import { useState } from 'react'
import { useTranslation, Trans } from 'react-i18next'
import { SubscriptionDashModalIds } from '../../../../../../../../../../types/subscription/dashboard/modal-ids'
import {
  postJSON,
  FetchError,
} from '../../../../../../../../infrastructure/fetch-json'
import getMeta from '../../../../../../../../utils/meta'
import { useSubscriptionDashboardContext } from '../../../../../../context/subscription-dashboard-context'
import { subscriptionUpdateUrl } from '../../../../../../data/subscription-url'
import { useLocation } from '../../../../../../../../shared/hooks/use-location'
import {
  OLModal,
  OLModalBody,
  OLModalFooter,
  OLModalHeader,
  OLModalTitle,
} from '@/shared/components/ol/ol-modal'
import OLButton from '@/shared/components/ol/ol-button'
import PaymentErrorNotification from '@/features/subscription/components/shared/payment-error-notification'
import handleStripePaymentAction from '@/features/subscription/util/handle-stripe-payment-action'

export function ConfirmChangePlanModal() {
  const modalId: SubscriptionDashModalIds = 'change-to-plan'
  const [error, setError] = useState<FetchError | null>(null)
  const [inflight, setInflight] = useState(false)
  const { t } = useTranslation()
  const { handleCloseModal, modalIdShown, plans, planCodeToChangeTo } =
    useSubscriptionDashboardContext()
  const planCodesChangingAtTermEnd = getMeta('ol-planCodesChangingAtTermEnd')
  const location = useLocation()

  async function handleConfirmChange() {
    setError(null)
    setInflight(true)

    try {
      await postJSON(`${subscriptionUpdateUrl}?origin=confirmChangePlan`, {
        body: {
          plan_code: planCodeToChangeTo,
        },
      })
      location.reload()
    } catch (e) {
      const fetchError = e as FetchError
      const { handled } = await handleStripePaymentAction(fetchError)
      if (handled) {
        location.reload()
      } else {
        setError(fetchError)
        setInflight(false)
      }
    }
  }

  if (modalIdShown !== modalId || !planCodeToChangeTo) return null

  const plan = plans.find(p => p.planCode === planCodeToChangeTo)
  if (!plan) return null

  const planWillChangeAtTermEnd =
    planCodesChangingAtTermEnd &&
    planCodesChangingAtTermEnd.indexOf(planCodeToChangeTo) > -1

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
        {error !== null && <PaymentErrorNotification error={error} />}
        <p>
          <Trans
            i18nKey="sure_you_want_to_change_plan"
            values={{
              planName: plan.name,
            }}
            shouldUnescape
            tOptions={{ interpolation: { escapeValue: true } }}
            components={[
              // eslint-disable-next-line react/jsx-key
              <strong />,
            ]}
          />
        </p>
        {planWillChangeAtTermEnd && (
          <>
            <p>{t('existing_plan_active_until_term_end')}</p>
            <p>{t('want_change_to_apply_before_plan_end')}</p>
          </>
        )}
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
          onClick={handleConfirmChange}
        >
          {t('change_plan')}
        </OLButton>
      </OLModalFooter>
    </OLModal>
  )
}
