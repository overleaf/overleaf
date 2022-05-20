import { useTranslation } from 'react-i18next'
import { Button } from 'react-bootstrap'
import Tooltip from '../../../shared/components/tooltip'
import Icon from '../../../shared/components/icon'
import { useMemo } from 'react'
import { useLayoutContext } from '../../../shared/context/layout-context'

function PdfExpandButton() {
  const { pdfLayout, switchLayout } = useLayoutContext()

  const { t } = useTranslation()

  const text = useMemo(() => {
    return pdfLayout === 'sideBySide' ? t('full_screen') : t('split_screen')
  }, [pdfLayout, t])

  return (
    <Tooltip
      id="expand-pdf-btn"
      description={text}
      overlayProps={{ placement: 'left' }}
    >
      <Button
        onClick={switchLayout}
        className="toolbar-pdf-expand-btn toolbar-item"
        aria-label={text}
      >
        <Icon type={pdfLayout === 'sideBySide' ? 'expand' : 'compress'} />
      </Button>
    </Tooltip>
  )
}

export default PdfExpandButton
