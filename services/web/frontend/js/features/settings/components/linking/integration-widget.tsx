import { useCallback, useState, ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import OLBadge from '@/shared/components/ol/ol-badge'
import getMeta from '../../../../utils/meta'
import { sendMB } from '../../../../infrastructure/event-tracking'
import OLButton from '@/shared/components/ol/ol-button'
import {
  OLModal,
  OLModalBody,
  OLModalFooter,
  OLModalHeader,
  OLModalTitle,
} from '@/shared/components/ol/ol-modal'

function trackUpgradeClick(integration: string) {
  sendMB('settings-upgrade-click', { integration })
}

function trackLinkingClick(integration: string) {
  sendMB('link-integration-click', { integration, location: 'Settings' })
}

type IntegrationLinkingWidgetProps = {
  id: string
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
  id,
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
          <h4 id={id}>{title}</h4>
          {!hasFeature && <OLBadge bg="info">{t('premium_feature')}</OLBadge>}
        </div>
        <p className="small">
          {description}{' '}
          <a href={helpPath} target="_blank" rel="noreferrer">
            {t('learn_more_about', { appName: title })}
          </a>
        </p>
        {hasFeature && statusIndicator}
      </div>
      <div>
        <ActionButton
          titleId={id}
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
  titleId: string
}

function ActionButton({
  hasFeature,
  linked,
  handleUnlinkClick,
  linkPath,
  disabled,
  integration,
  titleId,
}: ActionButtonProps) {
  const { t } = useTranslation()
  const upgradeTextId = `${titleId}-upgrade`
  const linkTextId = `${titleId}-link`
  const unlinkTextId = `${titleId}-unlink`

  if (!hasFeature) {
    return (
      <OLButton
        variant="primary"
        href="/user/subscription/plans"
        onClick={() => trackUpgradeClick(integration)}
        aria-labelledby={`${titleId} ${upgradeTextId}`}
      >
        <span id={upgradeTextId}>{t('upgrade')}</span>
      </OLButton>
    )
  } else if (linked) {
    return (
      <OLButton
        variant="danger-ghost"
        aria-labelledby={`${unlinkTextId} ${titleId}`}
        onClick={handleUnlinkClick}
        disabled={disabled}
        id={unlinkTextId}
      >
        {t('unlink')}
      </OLButton>
    )
  } else {
    return (
      <>
        {disabled ? (
          <OLButton
            disabled
            variant="secondary"
            aria-labelledby={`${linkTextId} ${titleId}`}
            id={linkTextId}
          >
            {t('link')}
          </OLButton>
        ) : (
          <OLButton
            variant="secondary"
            href={linkPath}
            onClick={() => trackLinkingClick(integration)}
            aria-labelledby={`${linkTextId} ${titleId}`}
            id={linkTextId}
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
      <OLModalHeader>
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
