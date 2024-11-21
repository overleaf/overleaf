import Notification from '@/shared/components/notification'
import StartFreeTrialButton from '@/shared/components/start-free-trial-button'
import { useTranslation } from 'react-i18next'
import { FC } from 'react'
import { useFeatureFlag } from '@/shared/context/split-test-context'

export const CompileTimeWarningUpgradePromptInner: FC<{
  handleDismissWarning: () => void
}> = ({ handleDismissWarning }) => {
  const { t } = useTranslation()

  const hasNewPaywallCta = useFeatureFlag('paywall-cta')

  return (
    <Notification
      action={
        <StartFreeTrialButton
          variant="new-10s"
          source="compile-time-warning"
          buttonProps={{
            variant: 'secondary',
          }}
        >
          {hasNewPaywallCta
            ? t('get_more_compile_time')
            : t('start_free_trial_without_exclamation')}
        </StartFreeTrialButton>
      }
      ariaLive="polite"
      content={
        <div>
          <div>
            <span>{t('your_project_near_compile_timeout_limit')}</span>
          </div>
          <strong>{t('upgrade_for_12x_more_compile_time')}</strong>
          {'. '}
        </div>
      }
      type="warning"
      title={t('took_a_while')}
      isActionBelowContent
      isDismissible
      onDismiss={handleDismissWarning}
    />
  )
}
