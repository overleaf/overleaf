import { useTranslation } from 'react-i18next'
import { Button } from 'react-bootstrap'
import Icon from '../../../shared/components/icon'
import { useLayoutContext } from '../../../shared/context/layout-context'

function SwitchToEditorButton() {
  const { pdfLayout, setView, detachRole } = useLayoutContext()

  const { t } = useTranslation()

  if (detachRole) {
    return null
  }

  if (pdfLayout === 'sideBySide') {
    return null
  }

  function handleClick() {
    setView('editor')
  }

  return (
    <Button
      bsStyle={null}
      bsSize="xs"
      onClick={handleClick}
      className="switch-to-editor-btn btn-secondary"
    >
      <Icon type="code" className="me-1" />
      {t('switch_to_editor')}
    </Button>
  )
}

export default SwitchToEditorButton
