import Notification from '@/shared/components/notification'
import StartFreeTrialButton from '@/shared/components/start-free-trial-button'
import * as eventTracking from '../../../infrastructure/event-tracking'
import { useTranslation } from 'react-i18next'
import { FC } from 'react'

export const CompileTimeWarningUpgradePromptInner: FC<{
  handleDismissWarning: () => void
  segmentation: eventTracking.Segmentation
}> = ({ handleDismissWarning, segmentation }) => {
  const { t } = useTranslation()

  return (
    <Notification
      action={
        <StartFreeTrialButton
          source="compile-time-warning"
          segmentation={segmentation}
          buttonProps={{
            variant: 'secondary',
            size: 'sm',
          }}
        >
          {t('start_free_trial_without_exclamation')}
        </StartFreeTrialButton>
      }
      ariaLive="polite"
      content={
        <div>
          <div>
            <span>{t('your_project_near_compile_timeout_limit')}</span>
          </div>
          <strong>{t('upgrade_for_more_compile_time')}</strong>
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
