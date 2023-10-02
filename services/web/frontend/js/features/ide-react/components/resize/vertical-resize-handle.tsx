import { PanelResizeHandle } from 'react-resizable-panels'
import { useTranslation } from 'react-i18next'
import { PanelResizeHandleProps } from 'react-resizable-panels/dist/declarations/src/PanelResizeHandle'

export function VerticalResizeHandle(props: PanelResizeHandleProps) {
  const { t } = useTranslation()

  return (
    <PanelResizeHandle {...props}>
      <div className="vertical-resize-handle" title={t('resize')} />
    </PanelResizeHandle>
  )
}
