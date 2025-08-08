import { Trans, useTranslation } from 'react-i18next'
import { Plan } from '../../../../../../../../../types/subscription/plan'
import { postJSON } from '../../../../../../../infrastructure/fetch-json'
import LoadingSpinner from '../../../../../../../shared/components/loading-spinner'
import useAsync from '../../../../../../../shared/hooks/use-async'
import { useSubscriptionDashboardContext } from '../../../../../context/subscription-dashboard-context'
import {
  cancelSubscriptionUrl,
  redirectAfterCancelSubscriptionUrl,
} from '../../../../../data/subscription-url'
import GenericErrorAlert from '../../../generic-error-alert'
import DowngradePlanButton from './downgrade-plan-button'
import ExtendTrialButton from './extend-trial-button'
import { useLocation } from '../../../../../../../shared/hooks/use-location'
import { debugConsole } from '@/utils/debugging'
import OLButton from '@/shared/components/ol/ol-button'

const planCodeToDowngradeTo = 'paid-personal'

function ConfirmCancelSubscriptionButton({
  showNoThanks,
  onClick,
  disabled,
  isLoading,
}: {
  showNoThanks: boolean
  onClick: () => void
  disabled: boolean
  isLoading: boolean
}) {
  const { t } = useTranslation()
  const text = showNoThanks ? t('no_thanks_cancel_now') : t('cancel_my_account')
  return (
    <OLButton
      isLoading={isLoading}
      loadingLabel={t('processing_uppercase') + '…'}
      disabled={disabled}
      onClick={onClick}
      variant={showNoThanks ? 'link' : undefined}
    >
      {text}
    </OLButton>
  )
}

function NotCancelOption({
  isButtonDisabled,
  isLoadingSecondaryAction,
  isSuccessSecondaryAction,
  planToDowngradeTo,
  showExtendFreeTrial,
  showDowngrade,
  runAsyncSecondaryAction,
}: {
  isButtonDisabled: boolean
  isLoadingSecondaryAction: boolean
  isSuccessSecondaryAction: boolean
  planToDowngradeTo?: Plan
  showExtendFreeTrial: boolean
  showDowngrade: boolean
  runAsyncSecondaryAction: (promise: Promise<unknown>) => Promise<unknown>
}) {
  const { t } = useTranslation()

  const { setShowCancellation } = useSubscriptionDashboardContext()

  if (showExtendFreeTrial) {
    return (
      <>
        <p>
          <Trans
            i18nKey="have_more_days_to_try"
            values={{
              days: 14,
            }}
            shouldUnescape
            tOptions={{ interpolation: { escapeValue: true } }}
            components={{ strong: <strong /> }}
          />
        </p>
        <p>
          <ExtendTrialButton
            isButtonDisabled={isButtonDisabled}
            isLoading={isLoadingSecondaryAction || isSuccessSecondaryAction}
            runAsyncSecondaryAction={runAsyncSecondaryAction}
          />
        </p>
      </>
    )
  }

  if (showDowngrade && planToDowngradeTo) {
    return (
      <>
        <p>
          <Trans
            i18nKey="interested_in_cheaper_personal_plan"
            values={{
              price: planToDowngradeTo.displayPrice,
            }}
            shouldUnescape
            tOptions={{ interpolation: { escapeValue: true } }}
            components={[
              // eslint-disable-next-line react/jsx-key
              <strong />,
            ]}
          />
        </p>
        <p>
          <DowngradePlanButton
            isButtonDisabled={isButtonDisabled}
            isLoading={isLoadingSecondaryAction || isSuccessSecondaryAction}
            planToDowngradeTo={planToDowngradeTo}
            runAsyncSecondaryAction={runAsyncSecondaryAction}
          />
        </p>
      </>
    )
  }

  function handleKeepPlan() {
    setShowCancellation(false)
  }

  return (
    <p>
      <OLButton variant="secondary" onClick={handleKeepPlan}>
        {t('i_want_to_stay')}
      </OLButton>
    </p>
  )
}

export function CancelSubscription() {
  const { t } = useTranslation()
  const location = useLocation()
  const { personalSubscription, plans, userCanExtendTrial } =
    useSubscriptionDashboardContext()
  const {
    isLoading: isLoadingCancel,
    isError: isErrorCancel,
    isSuccess: isSuccessCancel,
    runAsync: runAsyncCancel,
  } = useAsync()
  const {
    isLoading: isLoadingSecondaryAction,
    isError: isErrorSecondaryAction,
    isSuccess: isSuccessSecondaryAction,
    runAsync: runAsyncSecondaryAction,
  } = useAsync()
  const isButtonDisabled =
    isLoadingCancel ||
    isLoadingSecondaryAction ||
    isSuccessSecondaryAction ||
    isSuccessCancel

  if (!personalSubscription || !('payment' in personalSubscription)) return null

  const showDowngrade =
    personalSubscription.payment.isEligibleForDowngradeUpsell
  const planToDowngradeTo = plans.find(
    plan => plan.planCode === planCodeToDowngradeTo
  )
  if (showDowngrade && !planToDowngradeTo) {
    return <LoadingSpinner />
  }

  async function handleCancelSubscription() {
    try {
      await runAsyncCancel(postJSON(cancelSubscriptionUrl))
      location.assign(redirectAfterCancelSubscriptionUrl)
    } catch (e) {
      debugConsole.error(e)
    }
  }

  const showExtendFreeTrial = userCanExtendTrial

  return (
    <>
      <div className="text-center">
        <p>
          <strong>{t('wed_love_you_to_stay')}</strong>
        </p>

        {(isErrorCancel || isErrorSecondaryAction) && <GenericErrorAlert />}

        <NotCancelOption
          showExtendFreeTrial={showExtendFreeTrial}
          showDowngrade={showDowngrade}
          isButtonDisabled={isButtonDisabled}
          isLoadingSecondaryAction={isLoadingSecondaryAction}
          isSuccessSecondaryAction={isSuccessSecondaryAction}
          planToDowngradeTo={planToDowngradeTo}
          runAsyncSecondaryAction={runAsyncSecondaryAction}
        />

        <ConfirmCancelSubscriptionButton
          showNoThanks={showExtendFreeTrial || showDowngrade}
          onClick={handleCancelSubscription}
          disabled={isButtonDisabled}
          isLoading={isSuccessCancel || isLoadingCancel}
        />
      </div>
    </>
  )
}
