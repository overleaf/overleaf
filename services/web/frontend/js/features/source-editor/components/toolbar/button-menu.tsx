import { FC, memo, useRef } from 'react'
import useDropdown from '../../../../shared/hooks/use-dropdown'
import OLListGroup from '@/features/ui/components/ol/ol-list-group'
import OLTooltip from '@/features/ui/components/ol/ol-tooltip'
import OLOverlay from '@/features/ui/components/ol/ol-overlay'
import OLPopover from '@/features/ui/components/ol/ol-popover'
import { EditorView } from '@codemirror/view'
import { emitToolbarEvent } from '../../extensions/toolbar/utils/analytics'
import { useCodeMirrorViewContext } from '../codemirror-context'

export const ToolbarButtonMenu: FC<{
  id: string
  label: string
  icon: React.ReactNode
  altCommand?: (view: EditorView) => void
}> = memo(function ButtonMenu({ icon, id, label, altCommand, children }) {
  const target = useRef<any>(null)
  const { open, onToggle, ref } = useDropdown()
  const view = useCodeMirrorViewContext()

  const button = (
    <button
      type="button"
      className="ol-cm-toolbar-button btn"
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
      show={open}
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
