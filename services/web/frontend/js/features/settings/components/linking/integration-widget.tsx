import { useCallback, useState, ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import OLBadge from '@/features/ui/components/ol/ol-badge'
import getMeta from '../../../../utils/meta'
import { sendMB } from '../../../../infrastructure/event-tracking'
import OLButton from '@/features/ui/components/ol/ol-button'
import OLModal, {
  OLModalBody,
  OLModalFooter,
  OLModalHeader,
  OLModalTitle,
} from '@/features/ui/components/ol/ol-modal'

function trackUpgradeClick(integration: string) {
  sendMB('settings-upgrade-click', { integration })
}

function trackLinkingClick(integration: string) {
  sendMB('link-integration-click', { integration, location: 'Settings' })
}

type IntegrationLinkingWidgetProps = {
  logo: ReactNode
  title: string
  description: string
  helpPath: string
  hasFeature?: boolean
  statusIndicator?: ReactNode
  linked?: boolean
  linkPath: string
  unlinkPath: string
  unlinkConfirmationTitle: string
  unlinkConfirmationText: string
  disabled?: boolean
}

export function IntegrationLinkingWidget({
  logo,
  title,
  description,
  helpPath,
  hasFeature,
  statusIndicator,
  linked,
  linkPath,
  unlinkPath,
  unlinkConfirmationTitle,
  unlinkConfirmationText,
  disabled,
}: IntegrationLinkingWidgetProps) {
  const { t } = useTranslation()

  const [showModal, setShowModal] = useState(false)

  const handleUnlinkClick = useCallback(() => {
    setShowModal(true)
  }, [])

  const handleModalHide = useCallback(() => {
    setShowModal(false)
  }, [])

  return (
    <div className="settings-widget-container">
      <div>{logo}</div>
      <div className="description-container">
        <div className="title-row">
          <h4>{title}</h4>
          {!hasFeature && <OLBadge bg="info">{t('premium_feature')}</OLBadge>}
        </div>
        <p className="small">
          {description}{' '}
          <a href={helpPath} target="_blank" rel="noreferrer">
            {t('learn_more')}
          </a>
        </p>
        {hasFeature && statusIndicator}
      </div>
      <div>
        <ActionButton
          integration={title}
          hasFeature={hasFeature}
          linked={linked}
          handleUnlinkClick={handleUnlinkClick}
          linkPath={linkPath}
          disabled={disabled}
        />
      </div>
      <UnlinkConfirmationModal
        integration={title}
        show={showModal}
        title={unlinkConfirmationTitle}
        content={unlinkConfirmationText}
        unlinkPath={unlinkPath}
        handleHide={handleModalHide}
      />
    </div>
  )
}

type ActionButtonProps = {
  integration: string
  hasFeature?: boolean
  linked?: boolean
  handleUnlinkClick: () => void
  linkPath: string
  disabled?: boolean
}

function ActionButton({
  hasFeature,
  linked,
  handleUnlinkClick,
  linkPath,
  disabled,
  integration,
}: ActionButtonProps) {
  const { t } = useTranslation()
  if (!hasFeature) {
    return (
      <OLButton
        variant="primary"
        href="/user/subscription/plans"
        onClick={() => trackUpgradeClick(integration)}
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
        {t('unlink')}
      </OLButton>
    )
  } else {
    return (
      <>
        {disabled ? (
          <OLButton disabled variant="secondary" className="text-capitalize">
            {t('link')}
          </OLButton>
        ) : (
          <OLButton
            variant="secondary"
            href={linkPath}
            className="text-capitalize"
            onClick={() => trackLinkingClick(integration)}
          >
            {t('link')}
          </OLButton>
        )}
      </>
    )
  }
}

type UnlinkConfirmModalProps = {
  show: boolean
  title: string
  integration: string
  content: string
  unlinkPath: string
  handleHide: () => void
}

function UnlinkConfirmationModal({
  show,
  title,
  integration,
  content,
  unlinkPath,
  handleHide,
}: UnlinkConfirmModalProps) {
  const { t } = useTranslation()

  const handleCancel = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault()
    handleHide()
  }

  const handleConfirm = () => {
    sendMB('unlink-integration-click', {
      integration,
    })
  }

  return (
    <OLModal show={show} onHide={handleHide}>
      <OLModalHeader closeButton>
        <OLModalTitle>{title}</OLModalTitle>
      </OLModalHeader>

      <OLModalBody>
        <p>{content}</p>
      </OLModalBody>

      <OLModalFooter>
        <form action={unlinkPath} method="POST" className="form-inline">
          <input type="hidden" name="_csrf" value={getMeta('ol-csrfToken')} />
          <OLButton variant="secondary" onClick={handleCancel}>
            {t('cancel')}
          </OLButton>
          <OLButton
            type="submit"
            variant="danger-ghost"
            onClick={handleConfirm}
          >
            {t('unlink')}
          </OLButton>
        </form>
      </OLModalFooter>
    </OLModal>
  )
}
