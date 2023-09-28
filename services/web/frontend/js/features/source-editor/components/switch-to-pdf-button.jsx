import { useTranslation } from 'react-i18next'
import { Button } from 'react-bootstrap'
import Icon from '../../../shared/components/icon'
import { useLayoutContext } from '../../../shared/context/layout-context'

function SwitchToPDFButton() {
  const { pdfLayout, setView, detachRole } = useLayoutContext()

  const { t } = useTranslation()

  if (detachRole) {
    return null
  }

  if (pdfLayout === 'sideBySide') {
    return null
  }

  function handleClick() {
    setView('pdf')
  }

  return (
    <Button
      bsStyle={null}
      bsSize="xs"
      onClick={handleClick}
      className="switch-to-pdf-btn toolbar-btn-secondary btn-secondary"
    >
      <Icon type="file-pdf-o" className="toolbar-btn-secondary-icon" />
      <span className="toolbar-btn-secondary-text">{t('switch_to_pdf')}</span>
    </Button>
  )
}

export default SwitchToPDFButton
