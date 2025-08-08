import { useTranslation } from 'react-i18next'
import MaterialIcon from '@/shared/components/material-icon'
import OLButton from '@/shared/components/ol/ol-button'
import { useLayoutContext } from '../../../shared/context/layout-context'

function SwitchToEditorButton() {
  const { pdfLayout, restoreView, detachRole } = useLayoutContext()

  const { t } = useTranslation()

  if (detachRole) {
    return null
  }

  if (pdfLayout === 'sideBySide') {
    return null
  }

  function handleClick() {
    restoreView()
    window.setTimeout(() => {
      window.dispatchEvent(new Event('editor:focus'))
    })
  }

  return (
    <OLButton variant="secondary" size="sm" onClick={handleClick}>
      <MaterialIcon type="code" />
      {t('switch_to_editor')}
    </OLButton>
  )
}

export default SwitchToEditorButton
