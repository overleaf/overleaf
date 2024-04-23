import { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { sendMB } from '@/infrastructure/event-tracking'
import BadgeWrapper from '@/features/ui/components/bootstrap-5/wrappers/badge-wrapper'
import ButtonWrapper from '@/features/ui/components/bootstrap-5/wrappers/button-wrapper'

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
            <BadgeWrapper bg="info">{t('premium_feature')}</BadgeWrapper>
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
      <ButtonWrapper
        variant="primary"
        href="/user/subscription/plans"
        onClick={trackUpgradeClick}
        bs3Props={{ bsStyle: null, className: 'btn-primary' }}
      >
        <span className="text-capitalize">{t('upgrade')}</span>
      </ButtonWrapper>
    )
  } else if (linked) {
    return (
      <ButtonWrapper
        variant="danger-ghost"
        onClick={handleUnlinkClick}
        disabled={disabled}
        bs3Props={{ bsStyle: null, className: 'btn-danger-ghost' }}
      >
        {t('turn_off')}
      </ButtonWrapper>
    )
  } else {
    return (
      <ButtonWrapper
        variant="secondary"
        disabled={disabled}
        onClick={handleLinkClick}
        bs3Props={{
          bsStyle: null,
          className: 'btn btn-secondary-info btn-secondary',
        }}
      >
        {t('turn_on')}
      </ButtonWrapper>
    )
  }
}

export default EnableWidget
