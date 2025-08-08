import { FC, memo, useEffect, useRef } from 'react'
import useDropdown from '../../../../shared/hooks/use-dropdown'
import OLListGroup from '@/shared/components/ol/ol-list-group'
import OLTooltip from '@/shared/components/ol/ol-tooltip'
import OLOverlay from '@/shared/components/ol/ol-overlay'
import OLPopover from '@/shared/components/ol/ol-popover'
import { EditorView } from '@codemirror/view'
import { emitToolbarEvent } from '../../extensions/toolbar/utils/analytics'
import { useCodeMirrorViewContext } from '../codemirror-context'

export const ToolbarButtonMenu: FC<
  React.PropsWithChildren<{
    id: string
    label: string
    icon: React.ReactNode
    disablePopover?: boolean
    altCommand?: (view: EditorView) => void
  }>
> = memo(function ButtonMenu({
  icon,
  id,
  label,
  altCommand,
  disablePopover,
  children,
}) {
  const target = useRef<any>(null)
  const { open, onToggle, ref } = useDropdown()
  const view = useCodeMirrorViewContext()

  useEffect(() => {
    if (disablePopover && open) {
      onToggle(false)
    }
  }, [open, disablePopover, onToggle])

  const button = (
    <button
      type="button"
      className="ol-cm-toolbar-button"
      aria-label={label}
      onMouseDown={event => {
        event.preventDefault()
        event.stopPropagation()
      }}
      onClick={event => {
        if (event.altKey && altCommand && open === false) {
          emitToolbarEvent(view, id)
          event.preventDefault()
          altCommand(view)
          view.focus()
        } else {
          onToggle(!open)
        }
      }}
      ref={target}
    >
      {icon}
    </button>
  )

  const overlay = (
    <OLOverlay
      show={open && !disablePopover}
      target={target.current}
      placement="bottom"
      container={view.dom}
      containerPadding={0}
      transition
      rootClose
      onHide={() => onToggle(false)}
    >
      <OLPopover
        id={`${id}-menu`}
        ref={ref}
        className="ol-cm-toolbar-button-menu-popover"
      >
        <OLListGroup
          role="menu"
          onClick={() => {
            onToggle(false)
          }}
        >
          {children}
        </OLListGroup>
      </OLPopover>
    </OLOverlay>
  )

  if (!label) {
    return (
      <>
        {button}
        {overlay}
      </>
    )
  }

  return (
    <>
      <OLTooltip
        hidden={open}
        id={id}
        description={<div>{label}</div>}
        overlayProps={{ placement: 'bottom' }}
      >
        {button}
      </OLTooltip>
      {overlay}
    </>
  )
})
