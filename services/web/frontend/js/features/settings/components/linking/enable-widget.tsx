import { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from 'react-bootstrap'
import { sendMB } from '@/infrastructure/event-tracking'

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
            <span className="label label-info">{t('premium_feature')}</span>
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
}

function ActionButton({
  linked,
  handleUnlinkClick,
  handleLinkClick,
  hasFeature,
  disabled,
}: ActionButtonProps) {
  const { t } = useTranslation()
  if (!hasFeature) {
    return (
      <Button
        bsStyle={null}
        className="btn-primary"
        href="/user/subscription/plans"
        onClick={trackUpgradeClick}
      >
        <span className="text-capitalize">{t('upgrade')}</span>
      </Button>
    )
  } else if (linked) {
    return (
      <Button
        className="btn-danger-ghost"
        onClick={handleUnlinkClick}
        bsStyle={null}
        disabled={disabled}
      >
        {t('turn_off')}
      </Button>
    )
  } else {
    return (
      <Button
        disabled={disabled}
        bsStyle={null}
        onClick={handleLinkClick}
        className="btn btn-secondary-info btn-secondary text-capitalize"
      >
        {t('turn_on')}
      </Button>
    )
  }
}

export default EnableWidget
