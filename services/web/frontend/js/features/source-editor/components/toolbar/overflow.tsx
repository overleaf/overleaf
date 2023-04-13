import { FC, LegacyRef, memo } from 'react'
import { Button, Overlay, Popover } from 'react-bootstrap'
import classnames from 'classnames'
import Icon from '../../../../shared/components/icon'

export const ToolbarOverflow: FC<{
  overflowed: boolean
  target?: HTMLDivElement
  overflowOpen: boolean
  setOverflowOpen: (open: boolean) => void
  overflowRef?: LegacyRef<Popover>
}> = memo(function ToolbarOverflow({
  overflowed,
  target,
  overflowOpen,
  setOverflowOpen,
  overflowRef,
  children,
}) {
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
        target={target}
        placement="bottom"
        container={document.querySelector('.cm-editor')}
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
})
