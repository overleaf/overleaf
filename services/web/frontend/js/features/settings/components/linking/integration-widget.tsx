import { useCallback, useState, ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import AccessibleModal from '../../../../shared/components/accessible-modal'
import { Button, Modal } from 'react-bootstrap'
import getMeta from '../../../../utils/meta'

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
        {linked && statusIndicator}
      </div>
      <div>
        <ActionButton
          hasFeature={hasFeature}
          upgradePath="/user/subscription/plans"
          linked={linked}
          handleUnlinkClick={handleUnlinkClick}
          linkPath={linkPath}
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
  upgradePath: string
  linked?: boolean
  handleUnlinkClick: () => void
  linkPath: string
}

function ActionButton({
  hasFeature,
  upgradePath,
  linked,
  handleUnlinkClick,
  linkPath,
}: ActionButtonProps) {
  const { t } = useTranslation()

  if (!hasFeature) {
    return (
      <a href={upgradePath} className="btn btn-info text-capitalize">
        {t('upgrade')}
      </a>
    )
  } else if (linked) {
    return (
      <button className="btn btn-danger" onClick={handleUnlinkClick}>
        {t('unlink')}
      </button>
    )
  } else {
    return (
      <a href={linkPath} className="btn btn-primary text-capitalize">
        {t('link')}
      </a>
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

  const handleCancel = event => {
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
          <Button onClick={handleCancel}>{t('cancel')}</Button>
          <Button type="submit" bsStyle="danger">
            {t('unlink')}
          </Button>
        </form>
      </Modal.Footer>
    </AccessibleModal>
  )
}
