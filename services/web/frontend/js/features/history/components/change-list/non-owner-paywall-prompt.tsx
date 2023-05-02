import { useTranslation } from 'react-i18next'

export function NonOwnerPaywallPrompt() {
  const { t } = useTranslation()

  return (
    <div className="history-paywall-prompt">
      <h2 className="history-paywall-heading">{t('premium_feature')}</h2>
      <p>{t('currently_seeing_only_24_hrs_history')}</p>
      <p>
        <strong>{t('ask_proj_owner_to_upgrade_for_full_history')}</strong>
      </p>
    </div>
  )
}
