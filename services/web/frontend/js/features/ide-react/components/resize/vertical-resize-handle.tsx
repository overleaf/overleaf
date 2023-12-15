import { PanelResizeHandle } from 'react-resizable-panels'
import { useTranslation } from 'react-i18next'
import { PanelResizeHandleProps } from 'react-resizable-panels/dist/declarations/src/PanelResizeHandle'
import classNames from 'classnames'

export function VerticalResizeHandle(props: PanelResizeHandleProps) {
  const { t } = useTranslation()

  return (
    <PanelResizeHandle {...props}>
      <div
        className={classNames('vertical-resize-handle', {
          'vertical-resize-handle-enabled': !props.disabled,
        })}
        title={t('resize')}
      />
    </PanelResizeHandle>
  )
}
