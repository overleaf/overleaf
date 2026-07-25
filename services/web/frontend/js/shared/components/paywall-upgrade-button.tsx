import OLButton from '@/shared/components/ol/ol-button'
import getMeta from '@/utils/meta'
import { useEditorAnalytics } from '@/shared/hooks/use-editor-analytics'
import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'

export default function PaywallUpgradeButton({
  referrer,
  paywallType,
  className,
}: {
  referrer: string
  paywallType: string
  className?: string
}) {
  const { t } = useTranslation()
  const { sendEvent } = useEditorAnalytics()
  const user = getMeta('ol-user')

  const handleClick = useCallback(() => {
    sendEvent('paywall-click', {
      upgradeType: user.hasPaidSubscription ? 'add-on' : 'standalone',
      'paywall-type': paywallType,
    })
  }, [sendEvent, user.hasPaidSubscription, paywallType])

  return (
    <OLButton
      variant="premium"
      size="sm"
      href={`/user/subscription/choose-your-plan?itm_referrer=${referrer}&itm_campaign=${paywallType}&paywall-type=${paywallType}`}
      target="_blank"
      rel="noreferrer"
      className={className}
      onClick={handleClick}
    >
      {t('upgrade')}
    </OLButton>
  )
}
