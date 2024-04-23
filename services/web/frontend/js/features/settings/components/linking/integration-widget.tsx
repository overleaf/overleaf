import { useCallback, useState, ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import AccessibleModal from '../../../../shared/components/accessible-modal'
import { Modal } from 'react-bootstrap'
import BadgeWrapper from '@/features/ui/components/bootstrap-5/wrappers/badge-wrapper'
import getMeta from '../../../../utils/meta'
import { sendMB } from '../../../../infrastructure/event-tracking'
import ButtonWrapper from '@/features/ui/components/bootstrap-5/wrappers/button-wrapper'
import { bsVersion } from '@/features/utils/bootstrap-5'

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
            <BadgeWrapper bg="info">{t('premium_feature')}</BadgeWrapper>
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
        {t('unlink')}
      </ButtonWrapper>
    )
  } else {
    return (
      <>
        {disabled ? (
          <ButtonWrapper
            disabled
            variant="secondary"
            className={bsVersion({
              bs3: 'btn btn-secondary-info btn-secondary text-capitalize',
              bs5: 'text-capitalize',
            })}
          >
            {t('link')}
          </ButtonWrapper>
        ) : (
          <ButtonWrapper
            variant="secondary"
            href={linkPath}
            className={bsVersion({
              bs3: 'btn btn-secondary-info btn-secondary text-capitalize',
              bs5: 'text-capitalize',
            })}
            bs3Props={{ bsStyle: null }}
          >
            {t('link')}
          </ButtonWrapper>
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

  const handleCancel = (event: React.MouseEvent<HTMLButtonElement>) => {
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
          <ButtonWrapper
            variant="secondary"
            onClick={handleCancel}
            bs3Props={{
              bsStyle: null,
              className: 'btn-secondary-info btn-secondary',
            }}
          >
            {t('cancel')}
          </ButtonWrapper>
          <ButtonWrapper
            type="submit"
            variant="danger-ghost"
            bs3Props={{ bsStyle: null, className: 'btn-danger-ghost' }}
          >
            {t('unlink')}
          </ButtonWrapper>
        </form>
      </Modal.Footer>
    </AccessibleModal>
  )
}
