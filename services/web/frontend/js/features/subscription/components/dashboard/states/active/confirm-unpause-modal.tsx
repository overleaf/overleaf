import { useState } from 'react'
import { SubscriptionDashModalIds } from '../../../../../../../../types/subscription/dashboard/modal-ids'
import { Trans, useTranslation } from 'react-i18next'
import { useSubscriptionDashboardContext } from '@/features/subscription/context/subscription-dashboard-context'
import {
  OLModal,
  OLModalBody,
  OLModalFooter,
  OLModalHeader,
  OLModalTitle,
} from '@/shared/components/ol/ol-modal'
import OLButton from '@/shared/components/ol/ol-button'
import { postJSON } from '@/infrastructure/fetch-json'
import { useLocation } from '@/shared/hooks/use-location'
import OLNotification from '@/shared/components/ol/ol-notification'
import { PaidSubscription } from '../../../../../../../../types/subscription/dashboard/subscription'

export function ConfirmUnpauseSubscriptionModal() {
  const modalId: SubscriptionDashModalIds = 'unpause-subscription'
  const [error, setError] = useState(false)
  const [inflight, setInflight] = useState(false)
  const { t } = useTranslation()
  const { handleCloseModal, modalIdShown, personalSubscription } =
    useSubscriptionDashboardContext()
  const location = useLocation()
  const subscription = personalSubscription as PaidSubscription

  async function handleConfirmUnpause() {
    setError(false)
    setInflight(true)
    try {
      await postJSON('/user/subscription/resume')
      const newUrl = new URL(location.toString())
      newUrl.searchParams.set('flash', 'unpaused')
      window.history.replaceState(null, '', newUrl)
      location.reload()
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
        <OLModalTitle>{t('pick_up_where_you_left_off')}</OLModalTitle>
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
            i18nKey="lets_get_those_premium_features"
            values={{
              paymentAmount: subscription.payment.displayPrice,
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
          loadingLabel={t('unpausing')}
          onClick={handleConfirmUnpause}
        >
          {t('unpause_subscription')}
        </OLButton>
      </OLModalFooter>
    </OLModal>
  )
}
