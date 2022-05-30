import { Alert } from 'react-bootstrap'
import { useTranslation } from 'react-i18next'
import usePersistedState from '../../../shared/hooks/use-persisted-state'

const BROWSER_IS_SAFARI =
  navigator.userAgent &&
  /.*Safari\/.*/.test(navigator.userAgent) &&
  !/.*Chrome\/.*/.test(navigator.userAgent) &&
  !/.*Chromium\/.*/.test(navigator.userAgent)

function PdfPreviewDetachedRootSafariWarning() {
  const { t } = useTranslation()

  const [hidePdfDetachSafariAlert, setHidePdfDetachSafariAlert] =
    usePersistedState('hide-pdf-detach-safari-alert', false, true)

  function handleDismiss() {
    setHidePdfDetachSafariAlert(true)
  }

  if (!BROWSER_IS_SAFARI) {
    return null
  }

  if (hidePdfDetachSafariAlert) {
    return null
  }

  return (
    <div className="global-alerts global-alerts-detached">
      <Alert bsStyle="warning" onDismiss={handleDismiss}>
        {t('pdf_detach_safari_issues')}
      </Alert>
    </div>
  )
}

export default PdfPreviewDetachedRootSafariWarning
