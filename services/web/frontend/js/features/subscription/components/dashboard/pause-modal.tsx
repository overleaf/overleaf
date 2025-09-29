import { useTranslation } from 'react-i18next'
import { useSubscriptionDashboardContext } from '../../context/subscription-dashboard-context'
import { useCallback, useMemo, useState } from 'react'
import { postJSON } from '@/infrastructure/fetch-json'
import { useLocation } from '@/shared/hooks/use-location'
import {
  OLModal,
  OLModalBody,
  OLModalHeader,
} from '@/shared/components/ol/ol-modal'
import { Select } from '@/shared/components/select'
import OLFormGroup from '@/shared/components/ol/ol-form-group'
import Button from '@/shared/components/button/button'
import { Stack } from 'react-bootstrap'
import { debugConsole } from '@/utils/debugging'
import * as eventTracking from '../../../../infrastructure/event-tracking'
import PauseDuck from '../../images/pause-duck.svg'
import GenericErrorAlert from './generic-error-alert'
import { PaidSubscription } from '../../../../../../types/subscription/dashboard/subscription'

const pauseMonthDurationOptions = [1, 2, 3]

export const PAUSE_SUB_MODAL_ID = 'pause-subscription'

export default function PauseSubscriptionModal() {
  const { t } = useTranslation()
  const {
    handleCloseModal,
    modalIdShown,
    setShowCancellation,
    personalSubscription,
  } = useSubscriptionDashboardContext()
  const [inflight, setInflight] = useState(false)
  const [pauseError, setPauseError] = useState(false)
  const [selectedDuration, setSelectedDuration] = useState(1)
  const location = useLocation()

  function handleCancelSubscriptionClick() {
    const subscription = personalSubscription as PaidSubscription
    eventTracking.sendMB('subscription-page-cancel-button-click', {
      plan_code: subscription?.planCode,
      is_trial:
        subscription?.payment.trialEndsAtFormatted &&
        subscription?.payment.trialEndsAt &&
        new Date(subscription.payment.trialEndsAt).getTime() > Date.now(),
    })
    setShowCancellation(true)
  }

  const pauseSelectItems = useMemo(
    () =>
      pauseMonthDurationOptions.map(month => ({
        key: month,
        value: `${month} ${t('month', { count: month })}`,
      })),
    [t]
  )

  const handleConfirmPauseSubscriptionClick = useCallback(async () => {
    if (!selectedDuration) {
      return
    }
    setPauseError(false)
    setInflight(true)
    try {
      await postJSON(`/user/subscription/pause/${selectedDuration}`)
      const newUrl = new URL(location.toString())
      newUrl.searchParams.set('flash', 'paused')
      window.history.replaceState(null, '', newUrl)

      location.reload()
    } catch (err) {
      debugConsole.error('error pausing subscription', err)
      setInflight(false)
      setPauseError(true)
    }
  }, [location, selectedDuration])

  if (modalIdShown !== PAUSE_SUB_MODAL_ID) {
    return null
  }

  return (
    <OLModal
      id={PAUSE_SUB_MODAL_ID}
      show
      animation
      onHide={handleCloseModal}
      backdrop="static"
    >
      <OLModalBody>
        <OLModalHeader style={{ border: 0 }} />
        <img
          src={PauseDuck}
          alt="Need to duck out for a while?"
          style={{ display: 'block', margin: '-32px auto 0 auto' }}
        />
        {pauseError && <GenericErrorAlert />}

        <h4>{t('why_not_pause_instead')}</h4>
        <p>{t('your_current_plan_gives_you')}</p>
        <span>{t('dont_forget_you_currently_have')}</span>
        <ul>
          {personalSubscription?.plan?.features?.collaborators !== 1 && (
            <li>{t('more_collabs_per_project')}</li>
          )}
          <li>{t('more_compile_time')}</li>
          <li>{t('features_like_track_changes')}</li>
          <li>{t('integrations_like_github')}</li>
        </ul>
        <OLFormGroup>
          <Select
            label={t('pause_subscription_for')}
            items={pauseSelectItems}
            itemToString={x => String(x?.value)}
            itemToKey={x => String(x.key)}
            defaultText={`1 ${t('month')}`}
            onSelectedItemChanged={item => setSelectedDuration(item?.key || 0)}
          />
        </OLFormGroup>
        <Stack gap={2}>
          <Button
            onClick={handleConfirmPauseSubscriptionClick}
            disabled={inflight}
          >
            {t('pause_subscription')}
          </Button>
          <Button
            onClick={handleCancelSubscriptionClick}
            disabled={inflight}
            variant="danger-ghost"
          >
            {t('cancel_subscription')}
          </Button>
        </Stack>
      </OLModalBody>
    </OLModal>
  )
}
