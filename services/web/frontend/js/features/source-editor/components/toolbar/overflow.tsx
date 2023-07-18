import { FC, LegacyRef, useRef } from 'react'
import { Button, Overlay, Popover } from 'react-bootstrap'
import classnames from 'classnames'
import Icon from '../../../../shared/components/icon'
import { useCodeMirrorViewContext } from '../codemirror-editor'

export const ToolbarOverflow: FC<{
  overflowed: boolean
  overflowOpen: boolean
  setOverflowOpen: (open: boolean) => void
  overflowRef?: LegacyRef<Popover>
}> = ({ overflowed, overflowOpen, setOverflowOpen, overflowRef, children }) => {
  const buttonRef = useRef<Button>(null)
  const view = useCodeMirrorViewContext()

  const className = classnames(
    'ol-cm-toolbar-button',
    'ol-cm-toolbar-overflow-toggle',
    {
      'ol-cm-toolbar-overflow-toggle-visible': overflowed,
    }
  )

  return (
    <>
      <Button
        ref={buttonRef}
        type="button"
        id="toolbar-more"
        className={className}
        aria-label="More"
        bsStyle={null}
        onMouseDown={event => {
          event.preventDefault()
          event.stopPropagation()
        }}
        onClick={() => {
          setOverflowOpen(!overflowOpen)
        }}
      >
        <Icon type="ellipsis-h" fw />
      </Button>

      <Overlay
        show={overflowOpen}
        target={buttonRef.current ?? undefined}
        placement="bottom"
        container={view.dom}
        containerPadding={0}
        animation
        onHide={() => setOverflowOpen(false)}
      >
        <Popover id="popover-toolbar-overflow" ref={overflowRef}>
          <div className="ol-cm-toolbar-overflow">{children}</div>
        </Popover>
      </Overlay>
    </>
  )
}
