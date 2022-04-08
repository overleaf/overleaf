import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button, Modal } from 'react-bootstrap'
import AccessibleModal from '../../../shared/components/accessible-modal'

type SSOLinkingWidgetProps = {
  logoSrc: string
  title: string
  description: string
  linked?: boolean
  linkPath: string
  onUnlink: () => Promise<void>
  unlinkConfirmationTitle: string
  unlinkConfirmationText: string
}

export function SSOLinkingWidget({
  logoSrc,
  title,
  description,
  linked,
  linkPath,
  onUnlink,
  unlinkConfirmationTitle,
  unlinkConfirmationText,
}: SSOLinkingWidgetProps) {
  const [showModal, setShowModal] = useState(false)
  const [unlinkRequestInflight, setUnlinkRequestInflight] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  const handleUnlinkClick = useCallback(() => {
    setShowModal(true)
  }, [])

  const handleUnlinkConfirmationClick = useCallback(() => {
    setShowModal(false)
    setUnlinkRequestInflight(true)
    onUnlink()
      .catch((error: Error) => {
        setErrorMessage(error.message)
      })
      .finally(() => {
        setUnlinkRequestInflight(false)
      })
  }, [onUnlink])

  const handleModalHide = useCallback(() => {
    setShowModal(false)
  }, [])

  return (
    <div className="row">
      <div className="col-xs-2 col-sm-2 col-md-2">
        <img alt={title} src={logoSrc} />
      </div>
      <div className="col-xs-10 col-sm-6 col-md-8">
        <h4>{title}</h4>
        <p>{description}</p>
        {errorMessage && <div>{errorMessage} </div>}
      </div>
      <div className="col-xs-2 col-sm-4 col-md-2 text-right">
        <ActionButton
          unlinkRequestInflight={unlinkRequestInflight}
          accountIsLinked={linked}
          linkPath={linkPath}
          onUnlinkClick={handleUnlinkClick}
        />
      </div>
      <UnlinkConfirmModal
        show={showModal}
        title={unlinkConfirmationTitle}
        content={unlinkConfirmationText}
        handleConfirmation={handleUnlinkConfirmationClick}
        handleHide={handleModalHide}
      />
    </div>
  )
}
type ActionButtonProps = {
  unlinkRequestInflight: boolean
  accountIsLinked?: boolean
  linkPath: string
  onUnlinkClick: () => void
}

function ActionButton({
  unlinkRequestInflight,
  accountIsLinked,
  linkPath,
  onUnlinkClick,
}: ActionButtonProps) {
  const { t } = useTranslation()
  if (unlinkRequestInflight) {
    return (
      <button disabled className="btn default">
        {t('unlinking')}
      </button>
    )
  } else if (accountIsLinked) {
    return (
      <button className="btn default" onClick={onUnlinkClick}>
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
  handleConfirmation: () => void
  handleHide: () => void
}

function UnlinkConfirmModal({
  show,
  title,
  content,
  handleConfirmation,
  handleHide,
}: UnlinkConfirmModalProps) {
  const { t } = useTranslation()

  return (
    <AccessibleModal show={show} onHide={handleHide}>
      <Modal.Header closeButton>
        <Modal.Title>{title}</Modal.Title>
      </Modal.Header>

      <Modal.Body className="modal-body-share">
        <p>{content}</p>
      </Modal.Body>

      <Modal.Footer>
        <Button bsStyle="default" onClick={handleHide}>
          {t('cancel')}
        </Button>
        <Button bsStyle="danger" onClick={handleConfirmation}>
          {t('unlink')}
        </Button>
      </Modal.Footer>
    </AccessibleModal>
  )
}
