import { useTranslation } from 'react-i18next'
import { useCallback, useEffect, useState } from 'react'
import * as eventTracking from '../../../../infrastructure/event-tracking'
import StartFreeTrialButton from '../../../../shared/components/start-free-trial-button'
import UpgradeBenefits from '@/shared/components/upgrade-benefits'
import { useFeatureFlag } from '@/shared/context/split-test-context'

export function OwnerPaywallPrompt() {
  const { t } = useTranslation()
  const [clickedFreeTrialButton, setClickedFreeTrialButton] = useState(false)
  const showSubscribeNow = useFeatureFlag('paywall-cta-trial-ineligible')

  useEffect(() => {
    eventTracking.send('subscription-funnel', 'editor-click-feature', 'history')
  }, [])

  const handleFreeTrialClick = useCallback(() => {
    setClickedFreeTrialButton(true)
  }, [])

  return (
    <div className="history-paywall-prompt">
      <h2 className="history-paywall-heading">
        {t('get_full_project_history')}
      </h2>
      <p>{t('currently_seeing_only_24_hrs_history')}</p>
      <p>
        <strong>
          {t('upgrade_to_get_feature', { feature: 'full project history' })}
        </strong>
      </p>
      <UpgradeBenefits className="history-feature-list" />
      <p>
        <StartFreeTrialButton
          source="history"
          buttonProps={{ variant: 'premium' }}
          handleClick={handleFreeTrialClick}
        >
          {showSubscribeNow ? t('subscribe_now') : t('start_free_trial')}
        </StartFreeTrialButton>
      </p>
      {clickedFreeTrialButton ? (
        <p className="small">
          {showSubscribeNow
            ? t('refresh_page_after_subscribing')
            : t('refresh_page_after_starting_free_trial')}
        </p>
      ) : null}
    </div>
  )
}
