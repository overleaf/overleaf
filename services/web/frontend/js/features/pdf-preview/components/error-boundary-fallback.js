import PropTypes from 'prop-types'
import { Alert } from 'react-bootstrap'
import { Trans, useTranslation } from 'react-i18next'

function ErrorBoundaryFallback({ type }) {
  const { t } = useTranslation()

  // we create each instance of `<Trans/>` individually so `i18next-scanner` can detect hardcoded `i18nKey` values
  let content
  if (type === 'pdf') {
    content = (
      <>
        <p>{t('pdf_viewer_error')}</p>
        <p>
          <Trans
            i18nKey="try_recompile_project_or_troubleshoot"
            components={[
              // eslint-disable-next-line react/jsx-key, jsx-a11y/anchor-has-content
              <a href="/learn/how-to/Resolving_access%2C_loading%2C_and_display_problems" />,
            ]}
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
            i18nKey="try_recompile_project_or_troubleshoot"
            components={[
              // eslint-disable-next-line react/jsx-key, jsx-a11y/anchor-has-content
              <a href="/learn/how-to/Resolving_access%2C_loading%2C_and_display_problems" />,
            ]}
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
            i18nKey="try_recompile_project_or_troubleshoot"
            components={[
              // eslint-disable-next-line react/jsx-key, jsx-a11y/anchor-has-content
              <a href="/learn/how-to/Resolving_access%2C_loading%2C_and_display_problems" />,
            ]}
          />
        </p>
      </>
    )
  }

  return (
    <div className="pdf-error-alert">
      <Alert bsStyle="danger">{content}</Alert>
    </div>
  )
}

ErrorBoundaryFallback.propTypes = {
  type: PropTypes.oneOf(['preview', 'pdf', 'logs']).isRequired,
}

export default ErrorBoundaryFallback
