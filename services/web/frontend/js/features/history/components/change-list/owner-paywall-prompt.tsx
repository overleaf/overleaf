import { useTranslation } from 'react-i18next'
import Icon from '../../../../shared/components/icon'
import { useCallback, useEffect, useState } from 'react'
import * as eventTracking from '../../../../infrastructure/event-tracking'
import StartFreeTrialButton from '../../../../shared/components/start-free-trial-button'
import { paywallPrompt } from '../../../../main/account-upgrade'

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

  useEffect(() => {
    eventTracking.send('subscription-funnel', 'editor-click-feature', 'history')
    paywallPrompt('history')
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
          {t('upgrade_to_get_feature', { feature: 'full Project History' })}
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
          buttonProps={{ bsStyle: 'default', className: 'btn-premium' }}
          handleClick={handleFreeTrialClick}
        />
      </p>
      {clickedFreeTrialButton ? (
        <p className="small">{t('refresh_page_after_starting_free_trial')}</p>
      ) : null}
    </div>
  )
}
