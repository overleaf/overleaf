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
      bsStyle="default"
      bsSize="xs"
      onClick={handleClick}
      className="toolbar-item"
    >
      <Icon type="file-pdf-o" className="me-1" />
      {t('switch_to_pdf')}
    </Button>
  )
}

export default SwitchToPDFButton
