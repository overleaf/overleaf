import PropTypes from 'prop-types'
import { Alert } from 'react-bootstrap'
import { Trans, useTranslation } from 'react-i18next'
import { useState } from 'react'
import importOverleafModules from '../../../../macros/import-overleaf-module.macro'

const [contactUsModalModules] = importOverleafModules('contactUsModal')
const ContactUsModal = contactUsModalModules?.import.default

function ErrorBoundaryFallback({ type }) {
  const { t } = useTranslation()

  const [showContactUsModal, setShowContactUsModal] = useState(false)

  function handleContactUsClick() {
    setShowContactUsModal(true)
  }

  function handleContactUsModalHide() {
    setShowContactUsModal(false)
  }

  if (!ContactUsModal) {
    return (
      <div className="pdf-error-alert">
        <Alert bsStyle="danger">
          {`${t('generic_something_went_wrong')}. ${t('please_refresh')}`}
        </Alert>
      </div>
    )
  }

  // we create each instance of `<Trans/>` individually so `i18next-scanner` can detect hardcoded `i18nKey` values
  let content
  if (type === 'pdf') {
    content = (
      <>
        <p>{t('pdf_viewer_error')}</p>
        <p>
          <Trans
            i18nKey="try_recompile_project"
            components={[<a href="#" onClick={handleContactUsClick} />]} // eslint-disable-line react/jsx-key, jsx-a11y/anchor-has-content, jsx-a11y/anchor-is-valid
          />
        </p>
      </>
    )
  } else if (type === 'logs') {
    content = (
      <>
        <p>{t('log_viewer_error')}</p>
        <p>
          <Trans
            i18nKey="try_recompile_project"
            components={[<a href="#" onClick={handleContactUsClick} />]} // eslint-disable-line react/jsx-key, jsx-a11y/anchor-has-content, jsx-a11y/anchor-is-valid
          />
        </p>
      </>
    )
  } else {
    content = (
      <>
        <p>{t('pdf_preview_error')}</p>
        <p>
          <Trans
            i18nKey="try_refresh_page"
            components={[<a href="#" onClick={handleContactUsClick} />]} // eslint-disable-line react/jsx-key, jsx-a11y/anchor-has-content, jsx-a11y/anchor-is-valid
          />
        </p>
      </>
    )
  }

  return (
    <div className="pdf-error-alert">
      <Alert bsStyle="danger">{content}</Alert>
      <ContactUsModal
        show={showContactUsModal}
        handleHide={handleContactUsModalHide}
      />
    </div>
  )
}

ErrorBoundaryFallback.propTypes = {
  type: PropTypes.oneOf(['preview', 'pdf', 'logs']).isRequired,
}

export default ErrorBoundaryFallback
