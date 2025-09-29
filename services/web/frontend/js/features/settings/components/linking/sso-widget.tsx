import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { FetchError } from '../../../../infrastructure/fetch-json'
import IEEELogo from '../../../../shared/svgs/ieee-logo'
import GoogleLogo from '../../../../shared/svgs/google-logo'
import OrcidLogo from '../../../../shared/svgs/orcid-logo'
import LinkingStatus from './status'
import OLButton from '@/shared/components/ol/ol-button'
import {
  OLModal,
  OLModalBody,
  OLModalFooter,
  OLModalHeader,
  OLModalTitle,
} from '@/shared/components/ol/ol-modal'

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
          <h4 id={providerId}>{title}</h4>
        </div>
        <p className="small">
          {description?.replace(/<[^>]+>/g, '')}{' '}
          {helpPath ? (
            <a href={helpPath} target="_blank" rel="noreferrer">
              {t('learn_more_about', { appName: title })}
            </a>
          ) : null}
        </p>
        {errorMessage ? (
          <LinkingStatus status="error" description={errorMessage} />
        ) : null}
      </div>
      <div>
        <ActionButton
          titleId={providerId}
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
  titleId: string
}

function ActionButton({
  unlinkRequestInflight,
  accountIsLinked,
  linkPath,
  onUnlinkClick,
  titleId,
}: ActionButtonProps) {
  const { t } = useTranslation()
  const linkTextId = `${titleId}-link`

  if (unlinkRequestInflight) {
    return (
      <OLButton variant="danger-ghost" disabled>
        {t('unlinking')}
      </OLButton>
    )
  } else if (accountIsLinked) {
    return (
      <OLButton
        variant="danger-ghost"
        onClick={onUnlinkClick}
        aria-labelledby={`${linkTextId} ${titleId}`}
        id={linkTextId}
      >
        {t('unlink')}
      </OLButton>
    )
  } else {
    return (
      <OLButton
        variant="secondary"
        href={linkPath}
        aria-labelledby={`${linkTextId} ${titleId}`}
        id={linkTextId}
      >
        {t('link')}
      </OLButton>
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
    <OLModal show={show} onHide={handleHide}>
      <OLModalHeader>
        <OLModalTitle>
          {t('unlink_provider_account_title', { provider: title })}
        </OLModalTitle>
      </OLModalHeader>

      <OLModalBody>
        <p>{t('unlink_provider_account_warning', { provider: title })}</p>
      </OLModalBody>

      <OLModalFooter>
        <OLButton variant="secondary" onClick={handleHide}>
          {t('cancel')}
        </OLButton>
        <OLButton variant="danger-ghost" onClick={handleConfirmation}>
          {t('unlink')}
        </OLButton>
      </OLModalFooter>
    </OLModal>
  )
}
