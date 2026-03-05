import { useTranslation } from 'react-i18next'
import { useCallback, useEffect, useState } from 'react'
import * as eventTracking from '../../../../infrastructure/event-tracking'
import StartFreeTrialButton from '../../../../shared/components/start-free-trial-button'
import UpgradeBenefits from '@/shared/components/upgrade-benefits'
import { useFeatureFlag } from '@/shared/context/split-test-context'

export function OwnerPaywallPrompt() {
  const { t } = useTranslation()
  const [clickedFreeTrialButton, setClickedFreeTrialButton] = useState(false)
  const plans2026 = useFeatureFlag('plans-2026-phase-1')

  useEffect(() => {
    eventTracking.send('subscription-funnel', 'editor-click-feature', 'history')
    eventTracking.sendMB('paywall-prompt', { 'paywall-type': 'history' })
  }, [])

  const handleFreeTrialClick = useCallback(() => {
    setClickedFreeTrialButton(true)
  }, [])

  return (
    <div className="history-paywall-prompt">
      <h2 className="history-paywall-heading">
        {plans2026 ? t('get_full_project_history') : t('premium_feature')}
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
        />
      </p>
      {clickedFreeTrialButton ? (
        <p className="small">{t('refresh_page_after_starting_free_trial')}</p>
      ) : null}
    </div>
  )
}
