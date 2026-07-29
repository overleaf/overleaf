import { useTranslation } from 'react-i18next'
import * as eventTracking from '../../../../infrastructure/event-tracking'
import OLButton from '@/shared/components/ol/ol-button'
import classNames from 'classnames'
import useIsNetworkStalled from '@/features/ide-react/hooks/use-is-network-stalled'

export default function UpgradeButton({
  className = '',
  referrer = 'editor-header-upgrade-prompt',
  source = 'code-editor',
}: {
  className?: string
  referrer?: string
  source?: string
}) {
  const { t } = useTranslation()
  const isDisabledDueToNetworkStall = useIsNetworkStalled()

  function handleClick() {
    eventTracking.send('subscription-funnel', source, 'upgrade')
    eventTracking.sendMB('upgrade-button-click', { source })
  }

  return (
    <div className="ide-redesign-toolbar-button-container">
      <OLButton
        variant="premium"
        size="sm"
        href={
          isDisabledDueToNetworkStall
            ? undefined
            : `/user/subscription/choose-your-plan?itm_referrer=${referrer}&paywall-type=${source}`
        }
        target="_blank"
        rel="noreferrer"
        onClick={handleClick}
        disabled={isDisabledDueToNetworkStall}
        className={classNames(className, {
          disabled: isDisabledDueToNetworkStall,
        })}
      >
        {t('upgrade')}
      </OLButton>
    </div>
  )
}
