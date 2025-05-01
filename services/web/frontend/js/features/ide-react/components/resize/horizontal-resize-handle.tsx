import { PanelResizeHandle } from 'react-resizable-panels'
import { FC, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { PanelResizeHandleProps } from 'react-resizable-panels/dist/declarations/src/PanelResizeHandle'
import classNames from 'classnames'

type HorizontalResizeHandleOwnProps = {
  resizable?: boolean
  onDoubleClick?: () => void
}

export const HorizontalResizeHandle: FC<
  React.PropsWithChildren<
    HorizontalResizeHandleOwnProps & PanelResizeHandleProps
  >
> = ({ children, resizable = true, onDoubleClick, ...props }) => {
  const { t } = useTranslation()
  const [isDragging, setIsDragging] = useState(false)

  function handleDragging(isDraggingParam: boolean) {
    if (isDragging || resizable) {
      setIsDragging(isDraggingParam)
    }
  }

  // Only call onDragging prop when the pointer moves after starting a drag
  useEffect(() => {
    if (isDragging) {
      const handlePointerMove = () => {
        props.onDragging?.(true)
      }

      document.addEventListener('pointermove', handlePointerMove)
      return () => {
        document.removeEventListener('pointermove', handlePointerMove)
      }
    } else {
      props.onDragging?.(false)
    }
  }, [isDragging, props])

  return (
    <PanelResizeHandle
      disabled={!resizable && !isDragging}
      {...props}
      onDragging={handleDragging}
    >
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
