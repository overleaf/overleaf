import { useCallback, useState, ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import AccessibleModal from '../../../../shared/components/accessible-modal'
import { Button, Modal } from 'react-bootstrap'
import getMeta from '../../../../utils/meta'
import { sendMB } from '../../../../infrastructure/event-tracking'

function trackUpgradeClick() {
  sendMB('settings-upgrade-click')
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
          {!hasFeature && (
            <span className="label label-info">{t('premium_feature')}</span>
          )}
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
          hasFeature={hasFeature}
          linked={linked}
          handleUnlinkClick={handleUnlinkClick}
          linkPath={linkPath}
          disabled={disabled}
        />
      </div>
      <UnlinkConfirmationModal
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
}: ActionButtonProps) {
  const { t } = useTranslation()
  const classNames = require('classnames')
  const classes = classNames(
    'btn',
    'btn-secondary-info',
    'btn-secondary',
    'text-capitalize'
  )
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
      <Button bsStyle="danger" onClick={handleUnlinkClick} disabled={disabled}>
        {t('unlink')}
      </Button>
    )
  } else {
    return (
      <>
        {disabled ? (
          <button disabled className={classes}>
            {t('link')}
          </button>
        ) : (
          <a className={classes} href={linkPath}>
            {t('link')}
          </a>
        )}
      </>
    )
  }
}

type UnlinkConfirmModalProps = {
  show: boolean
  title: string
  content: string
  unlinkPath: string
  handleHide: () => void
}

function UnlinkConfirmationModal({
  show,
  title,
  content,
  unlinkPath,
  handleHide,
}: UnlinkConfirmModalProps) {
  const { t } = useTranslation()

  const handleCancel = (
    event: React.MouseEvent<HTMLButtonElement & Button>
  ) => {
    event.preventDefault()
    handleHide()
  }
  return (
    <AccessibleModal show={show} onHide={handleHide}>
      <Modal.Header closeButton>
        <Modal.Title>{title}</Modal.Title>
      </Modal.Header>

      <Modal.Body className="modal-body-share">
        <p>{content}</p>
      </Modal.Body>

      <Modal.Footer>
        <form action={unlinkPath} method="POST" className="form-inline">
          <input type="hidden" name="_csrf" value={getMeta('ol-csrfToken')} />
          <Button
            className="btn-secondary-info btn-secondary"
            onClick={handleCancel}
          >
            {t('cancel')}
          </Button>
          <Button type="submit" bsStyle="danger">
            {t('unlink')}
          </Button>
        </form>
      </Modal.Footer>
    </AccessibleModal>
  )
}
