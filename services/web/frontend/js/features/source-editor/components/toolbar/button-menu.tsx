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
    disabled?: boolean
    disablePopover?: boolean
    altCommand?: (view: EditorView) => void
    onToggle?: (isOpen: boolean) => void
  }>
> = memo(function ButtonMenu({
  icon,
  id,
  label,
  altCommand,
  onToggle,
  disabled,
  disablePopover,
  children,
}) {
  const target = useRef<any>(null)
  const { open, onToggle: handleToggle, ref } = useDropdown()
  const view = useCodeMirrorViewContext()

  useEffect(() => {
    if (disablePopover && open) {
      handleToggle(false)
    }
  }, [open, disablePopover, handleToggle])

  useEffect(() => {
    onToggle?.(open)
  }, [open, onToggle])

  const button = (
    <button
      type="button"
      className="ol-cm-toolbar-button"
      aria-label={label}
      aria-disabled={disabled}
      onMouseDown={event => {
        event.preventDefault()
        event.stopPropagation()
      }}
      onClick={event => {
        if (disabled) {
          event.preventDefault()
          return
        }
        if (event.altKey && altCommand && open === false) {
          emitToolbarEvent(view, id)
          event.preventDefault()
          altCommand(view)
          view.focus()
        } else {
          handleToggle(!open)
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
      onHide={() => handleToggle(false)}
    >
      <OLPopover
        id={`${id}-menu`}
        ref={ref}
        className="ol-cm-toolbar-button-menu-popover"
      >
        <OLListGroup
          role="menu"
          onClick={() => {
            handleToggle(false)
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
