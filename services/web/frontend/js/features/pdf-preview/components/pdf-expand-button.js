import { Button, OverlayTrigger, Tooltip } from 'react-bootstrap'
import { useTranslation } from 'react-i18next'
import Icon from '../../../shared/components/icon'
import { memo, useMemo } from 'react'
import { useLayoutContext } from '../../../shared/context/layout-context'

function PdfExpandButton() {
  const { pdfLayout, switchLayout } = useLayoutContext()

  const { t } = useTranslation()

  const text = useMemo(() => {
    return pdfLayout === 'sideBySide' ? t('full_screen') : t('split_screen')
  }, [pdfLayout, t])

  return (
    <OverlayTrigger
      placement="left"
      overlay={<Tooltip id="expand-pdf-btn">{text}</Tooltip>}
    >
      <Button
        onClick={switchLayout}
        className="toolbar-pdf-expand-btn toolbar-item"
        aria-label={text}
      >
        <Icon type={pdfLayout === 'sideBySide' ? 'expand' : 'compress'} />
      </Button>
    </OverlayTrigger>
  )
}

export default memo(PdfExpandButton)
