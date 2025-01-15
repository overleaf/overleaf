import { useTranslation } from 'react-i18next'
import Icon from '../../../../shared/components/icon'
import { useCallback, useEffect, useState } from 'react'
import * as eventTracking from '../../../../infrastructure/event-tracking'
import StartFreeTrialButton from '../../../../shared/components/start-free-trial-button'
import { useFeatureFlag } from '@/shared/context/split-test-context'

function FeatureItem({ text }: { text: string }) {
  return (
    <li>
      <Icon type="check" /> {text}
    </li>
  )
}

export function OwnerPaywallPrompt() {
  const { t } = useTranslation()
  const [clickedFreeTrialButton, setClickedFreeTrialButton] = useState(false)

  const hasNewPaywallCta = useFeatureFlag('paywall-cta')

  useEffect(() => {
    eventTracking.send('subscription-funnel', 'editor-click-feature', 'history')
    eventTracking.sendMB('paywall-prompt', { 'paywall-type': 'history' })
  }, [])

  const handleFreeTrialClick = useCallback(() => {
    setClickedFreeTrialButton(true)
  }, [])

  return (
    <div className="history-paywall-prompt">
      <h2 className="history-paywall-heading">{t('premium_feature')}</h2>
      <p>{t('currently_seeing_only_24_hrs_history')}</p>
      <p>
        <strong>
          {t('upgrade_to_get_feature', { feature: 'full project history' })}
        </strong>
      </p>
      <ul className="history-feature-list">
        <FeatureItem text={t('unlimited_projects')} />
        <FeatureItem
          text={t('collabs_per_proj', { collabcount: 'Multiple' })}
        />
        <FeatureItem text={t('full_doc_history')} />
        <FeatureItem text={t('sync_to_dropbox')} />
        <FeatureItem text={t('sync_to_github')} />
        <FeatureItem text={t('compile_larger_projects')} />
      </ul>
      <p>
        <StartFreeTrialButton
          source="history"
          buttonProps={{ variant: 'premium' }}
          handleClick={handleFreeTrialClick}
        >
          {hasNewPaywallCta
            ? t('get_full_project_history')
            : t('start_free_trial')}
        </StartFreeTrialButton>
      </p>
      {clickedFreeTrialButton ? (
        <p className="small">{t('refresh_page_after_starting_free_trial')}</p>
      ) : null}
    </div>
  )
}
