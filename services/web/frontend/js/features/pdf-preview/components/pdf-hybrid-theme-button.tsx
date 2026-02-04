import OLTooltip from '@/shared/components/ol/ol-tooltip'
import { useCallback, useId } from 'react'
import { useTranslation } from 'react-i18next'
import { useDetachCompileContext as useCompileContext } from '../../../shared/context/detach-compile-context'
import OLIconButton from '@/shared/components/ol/ol-icon-button'
import { useIsNewEditorEnabled } from '@/features/ide-redesign/utils/new-editor-utils'

export const PdfHybridThemeButton = () => {
  const id = useId()
  const { t } = useTranslation()
  const usesNewEditor = useIsNewEditorEnabled()
  const {
    pdfViewer,
    darkModePdf,
    setDarkModePdf,
    activeOverallTheme,
    showLogs,
  } = useCompileContext()

  const onClick = useCallback(() => {
    setDarkModePdf(!darkModePdf)
  }, [darkModePdf, setDarkModePdf])

  if (!usesNewEditor) {
    // The old editor does not support dark mode PDF, so don't show the button
    return null
  }

  if (activeOverallTheme !== 'dark') {
    return null
  }

  if (pdfViewer !== 'pdfjs') {
    // We can't affect the theme of the embedded viewer
    return null
  }

  if (showLogs) {
    // Don't show the button when logs are shown
    return null
  }

  const tooltipText = darkModePdf
    ? t('showing_pdf_preview_with_inverted_colors')
    : t('invert_pdf_preview_colors')

  return (
    <OLTooltip
      id={id}
      description={tooltipText}
      overlayProps={{ placement: 'bottom' }}
    >
      <OLIconButton
        icon="invert_colors"
        accessibilityLabel={tooltipText}
        variant="link"
        active={darkModePdf}
        className="pdf-toolbar-btn toolbar-item theme-toggle-btn"
        onClick={onClick}
        style={{ position: 'relative' }}
      />
    </OLTooltip>
  )
}
