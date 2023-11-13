import { PanelResizeHandle } from 'react-resizable-panels'
import { FC } from 'react'
import { useTranslation } from 'react-i18next'
import { PanelResizeHandleProps } from 'react-resizable-panels/dist/declarations/src/PanelResizeHandle'
import classNames from 'classnames'

type HorizontalResizeHandleOwnProps = {
  resizable?: boolean
  onDoubleClick?: () => void
}

export const HorizontalResizeHandle: FC<
  HorizontalResizeHandleOwnProps & PanelResizeHandleProps
> = ({ children, resizable = true, onDoubleClick, ...props }) => {
  const { t } = useTranslation()

  return (
    <PanelResizeHandle {...props}>
      <div
        className={classNames('horizontal-resize-handle', {
          'horizontal-resize-handle-enabled': resizable,
        })}
        title={t('resize')}
        onDoubleClick={() => onDoubleClick?.()}
      >
        {children}
      </div>
    </PanelResizeHandle>
  )
}
