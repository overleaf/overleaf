import { useTranslation } from 'react-i18next'
import { Button } from 'react-bootstrap'
import Tooltip from '../../../shared/components/tooltip'
import Icon from '../../../shared/components/icon'
import { useLayoutContext } from '../../../shared/context/layout-context'

const BROWSER_IS_SAFARI =
  navigator.userAgent &&
  /.*Safari\/.*/.test(navigator.userAgent) &&
  !/.*Chrome\/.*/.test(navigator.userAgent) &&
  !/.*Chromium\/.*/.test(navigator.userAgent)

function PdfHybridSafariWarning() {
  const { t } = useTranslation()
  const { detachRole } = useLayoutContext()

  if (!BROWSER_IS_SAFARI) {
    return null
  }

  if (detachRole !== 'detached') {
    return null
  }

  return (
    <Tooltip
      id="safari-pdf-detach-warning"
      description={t('pdf_detach_safari_issues')}
      overlayProps={{ placement: 'bottom' }}
    >
      <Button bsStyle="link">
        <Icon type="warning" fw />
      </Button>
    </Tooltip>
  )
}

export default PdfHybridSafariWarning
