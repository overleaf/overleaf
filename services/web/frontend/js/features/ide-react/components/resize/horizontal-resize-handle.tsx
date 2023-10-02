import { PanelResizeHandle } from 'react-resizable-panels'
import { FC } from 'react'
import { useTranslation } from 'react-i18next'
import { PanelResizeHandleProps } from 'react-resizable-panels/dist/declarations/src/PanelResizeHandle'

export const HorizontalResizeHandle: FC<PanelResizeHandleProps> = ({
  children,
  ...props
}) => {
  const { t } = useTranslation()

  return (
    <PanelResizeHandle {...props}>
      <div className="horizontal-resize-handle" title={t('resize')}>
        {children}
      </div>
    </PanelResizeHandle>
  )
}
