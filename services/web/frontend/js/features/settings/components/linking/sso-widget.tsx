import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button, Modal } from 'react-bootstrap'
import { FetchError } from '../../../../infrastructure/fetch-json'
import AccessibleModal from '../../../../shared/components/accessible-modal'
import IEEELogo from '../../../../shared/svgs/ieee-logo'
import GoogleLogo from '../../../../shared/svgs/google-logo'
import OrcidLogo from '../../../../shared/svgs/orcid-logo'
import LinkingStatus from './status'

const providerLogos: { readonly [p: string]: JSX.Element } = {
  collabratec: <IEEELogo />,
  google: <GoogleLogo />,
  orcid: <OrcidLogo />,
}

type SSOLinkingWidgetProps = {
  providerId: string
  title: string
  description: string
  helpPath?: string
  linked?: boolean
  linkPath: string
  onUnlink: () => Promise<void>
}

export function SSOLinkingWidget({
  providerId,
  title,
  description,
  helpPath,
  linked,
  linkPath,
  onUnlink,
}: SSOLinkingWidgetProps) {
  const { t } = useTranslation()
  const [showModal, setShowModal] = useState(false)
  const [unlinkRequestInflight, setUnlinkRequestInflight] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  const handleUnlinkClick = useCallback(() => {
    setShowModal(true)
    setErrorMessage('')
  }, [])

  const handleUnlinkConfirmationClick = useCallback(() => {
    setShowModal(false)
    setUnlinkRequestInflight(true)
    onUnlink()
      .catch((error: FetchError) => {
        setErrorMessage(error.getUserFacingMessage())
      })
      .finally(() => {
        setUnlinkRequestInflight(false)
      })
  }, [onUnlink])

  const handleModalHide = useCallback(() => {
    setShowModal(false)
  }, [])

  return (
    <div className="settings-widget-container">
      <div>{providerLogos[providerId]}</div>
      <div className="description-container">
        <div className="title-row">
          <h4>{title}</h4>
        </div>
        <p className="small">
          {description?.replace(/<[^>]+>/g, '')}{' '}
          {helpPath ? (
            <a href={helpPath} target="_blank" rel="noreferrer">
              {t('learn_more')}
            </a>
          ) : null}
        </p>
        {errorMessage ? (
          <LinkingStatus status="error" description={errorMessage} />
        ) : null}
      </div>
      <div>
        <ActionButton
          unlinkRequestInflight={unlinkRequestInflight}
          accountIsLinked={linked}
          linkPath={`${linkPath}?intent=link`}
          onUnlinkClick={handleUnlinkClick}
        />
      </div>
      <UnlinkConfirmModal
        title={title}
        show={showModal}
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
      <Button className="btn-danger-ghost" bsStyle={null} disabled>
        {t('unlinking')}
      </Button>
    )
  } else if (accountIsLinked) {
    return (
      <Button
        className="btn-danger-ghost"
        bsStyle={null}
        onClick={onUnlinkClick}
      >
        {t('unlink')}
      </Button>
    )
  } else {
    return (
      <a
        href={linkPath}
        className="btn btn-secondary-info btn-secondary text-capitalize"
      >
        {t('link')}
      </a>
    )
  }
}

type UnlinkConfirmModalProps = {
  title: string
  show: boolean
  handleConfirmation: () => void
  handleHide: () => void
}

function UnlinkConfirmModal({
  title,
  show,
  handleConfirmation,
  handleHide,
}: UnlinkConfirmModalProps) {
  const { t } = useTranslation()

  return (
    <AccessibleModal show={show} onHide={handleHide}>
      <Modal.Header closeButton>
        <Modal.Title>
          {t('unlink_provider_account_title', { provider: title })}
        </Modal.Title>
      </Modal.Header>

      <Modal.Body className="modal-body-share">
        <p>{t('unlink_provider_account_warning', { provider: title })}</p>
      </Modal.Body>

      <Modal.Footer>
        <Button
          bsStyle={null}
          className="btn-secondary-info btn-secondary"
          onClick={handleHide}
        >
          {t('cancel')}
        </Button>
        <Button
          className="btn-danger-ghost"
          bsStyle={null}
          onClick={handleConfirmation}
        >
          {t('unlink')}
        </Button>
      </Modal.Footer>
    </AccessibleModal>
  )
}
