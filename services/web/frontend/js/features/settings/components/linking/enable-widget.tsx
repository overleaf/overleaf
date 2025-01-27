import { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { sendMB } from '@/infrastructure/event-tracking'
import OLBadge from '@/features/ui/components/ol/ol-badge'
import OLButton from '@/features/ui/components/ol/ol-button'

function trackUpgradeClick() {
  sendMB('settings-upgrade-click')
}

type EnableWidgetProps = {
  logo: ReactNode
  title: string
  description: string
  helpPath: string
  helpTextOverride?: string
  hasFeature?: boolean
  isPremiumFeature?: boolean
  statusIndicator?: ReactNode
  children?: ReactNode
  linked?: boolean
  handleLinkClick: () => void
  handleUnlinkClick: () => void
  disabled?: boolean
}

export function EnableWidget({
  logo,
  title,
  description,
  helpPath,
  helpTextOverride,
  hasFeature,
  isPremiumFeature,
  statusIndicator,
  linked,
  handleLinkClick,
  handleUnlinkClick,
  children,
  disabled,
}: EnableWidgetProps) {
  const { t } = useTranslation()
  const helpText = helpTextOverride || t('learn_more')

  return (
    <div className="settings-widget-container">
      <div>{logo}</div>
      <div className="description-container">
        <div className="title-row">
          <h4>{title}</h4>
          {!hasFeature && isPremiumFeature && (
            <OLBadge bg="info">{t('premium_feature')}</OLBadge>
          )}
        </div>
        <p className="small">
          {description}{' '}
          <a href={helpPath} target="_blank" rel="noreferrer">
            {helpText}
          </a>
        </p>
        {children}
        {hasFeature && statusIndicator}
      </div>
      <div>
        <ActionButton
          hasFeature={hasFeature}
          linked={linked}
          handleUnlinkClick={handleUnlinkClick}
          handleLinkClick={handleLinkClick}
          disabled={disabled}
        />
      </div>
    </div>
  )
}

type ActionButtonProps = {
  hasFeature?: boolean
  linked?: boolean
  handleUnlinkClick: () => void
  handleLinkClick: () => void
  disabled?: boolean
  linkText?: string
  unlinkText?: string
}

export function ActionButton({
  linked,
  handleUnlinkClick,
  handleLinkClick,
  hasFeature,
  disabled,
  linkText,
  unlinkText,
}: ActionButtonProps) {
  const { t } = useTranslation()
  const linkingText = linkText || t('turn_on')
  const unlinkingText = unlinkText || t('turn_off')
  if (!hasFeature) {
    return (
      <OLButton
        variant="primary"
        href="/user/subscription/plans"
        onClick={trackUpgradeClick}
      >
        <span className="text-capitalize">{t('upgrade')}</span>
      </OLButton>
    )
  } else if (linked) {
    return (
      <OLButton
        variant="danger-ghost"
        onClick={handleUnlinkClick}
        disabled={disabled}
      >
        {unlinkingText}
      </OLButton>
    )
  } else {
    return (
      <OLButton
        variant="secondary"
        disabled={disabled}
        onClick={handleLinkClick}
      >
        {linkingText}
      </OLButton>
    )
  }
}

export default EnableWidget
