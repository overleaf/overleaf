import { useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from 'react-bootstrap'
import Tooltip from '../../../shared/components/tooltip'
import Icon from '../../../shared/components/icon'
import { useLayoutContext } from '../../../shared/context/layout-context'

function EditorExpandButton() {
  const { pdfLayout, changeLayout, detachRole } = useLayoutContext()

  const { t } = useTranslation()

  const text = useMemo(() => {
    return pdfLayout === 'sideBySide' ? t('full_screen') : t('split_screen')
  }, [pdfLayout, t])

  const switchEditorLayout = useCallback(() => {
    const newLayout = pdfLayout === 'sideBySide' ? 'flat' : 'sideBySide'
    changeLayout(newLayout, 'editor')
  }, [pdfLayout, changeLayout])

  if (detachRole) {
    return null
  }

  return (
    <Tooltip
      id="expand-editor-btn"
      description={text}
      overlayProps={{ placement: 'left' }}
    >
      <Button
        onClick={switchEditorLayout}
        className="toolbar-editor-expand-btn toolbar-item"
        aria-label={text}
      >
        <Icon type={pdfLayout === 'sideBySide' ? 'expand' : 'compress'} />
      </Button>
    </Tooltip>
  )
}

export default EditorExpandButton
