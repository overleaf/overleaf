import { memo, useCallback, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  useCodeMirrorStateContext,
  useCodeMirrorViewContext,
} from './codemirror-editor'
import { searchPanelOpen } from '@codemirror/search'
import { useResizeObserver } from '../../../shared/hooks/use-resize-observer'
import { ToolbarButton } from './toolbar/toolbar-button'
import { ToolbarItems } from './toolbar/toolbar-items'
import * as commands from '../extensions/toolbar/commands'
import { ToolbarOverflow } from './toolbar/overflow'
import useDropdown from '../../../shared/hooks/use-dropdown'
import { getPanel } from '@codemirror/view'
import { createToolbarPanel } from '../extensions/toolbar/toolbar-panel'

export const CodeMirrorToolbar = () => {
  const view = useCodeMirrorViewContext()
  const panel = getPanel(view, createToolbarPanel)

  if (!panel) {
    return null
  }

  return createPortal(<Toolbar />, panel.dom)
}

const Toolbar = memo(function Toolbar() {
  const state = useCodeMirrorStateContext()

  const [overflowed, setOverflowed] = useState(false)
  const [collapsed, setCollapsed] = useState(false)

  const overflowBeforeRef = useRef<HTMLDivElement>(null)
  const overflowedItemsRef = useRef<Set<string>>(new Set())

  const {
    open: overflowOpen,
    onToggle: setOverflowOpen,
    ref: overflowRef,
  } = useDropdown()

  const buildOverflow = useCallback(
    (element: Element) => {
      setOverflowOpen(false)
      setOverflowed(false)

      if (overflowBeforeRef.current) {
        overflowedItemsRef.current = new Set()

        const buttonGroups = [
          ...element.querySelectorAll<HTMLDivElement>('[data-overflow]'),
        ].reverse()

        // restore all the overflowed items
        for (const buttonGroup of buttonGroups) {
          buttonGroup.classList.remove('overflow-hidden')
        }

        // find all the available items
        for (const buttonGroup of buttonGroups) {
          if (element.scrollWidth <= element.clientWidth) {
            break
          }
          // add this item to the overflow
          overflowedItemsRef.current.add(buttonGroup.dataset.overflow!)
          buttonGroup.classList.add('overflow-hidden')
        }

        setOverflowed(overflowedItemsRef.current.size > 0)
      }
    },
    [setOverflowOpen]
  )

  // build when the container resizes
  const resizeRef = useResizeObserver(buildOverflow)

  const toggleToolbar = useCallback(() => {
    setCollapsed(value => !value)
  }, [])

  if (collapsed) {
    return null
  }

  return (
    <div className="ol-cm-toolbar" ref={resizeRef}>
      <ToolbarItems state={state} />
      <div className="ol-cm-toolbar-button-group" ref={overflowBeforeRef}>
        <ToolbarOverflow
          overflowed={overflowed}
          target={overflowBeforeRef.current ?? undefined}
          overflowOpen={overflowOpen}
          setOverflowOpen={setOverflowOpen}
          overflowRef={overflowRef}
        >
          <ToolbarItems state={state} overflowed={overflowedItemsRef.current} />
        </ToolbarOverflow>
      </div>
      <div className="ol-cm-toolbar-button-group ol-cm-toolbar-end">
        <ToolbarButton
          id="toolbar-toggle-search"
          label="Toggle Search"
          command={commands.toggleSearch}
          active={searchPanelOpen(state)}
          icon="search"
        />
      </div>
      <div className="ol-cm-toolbar-button-group hidden">
        <ToolbarButton
          id="toolbar-expand-less"
          label="Hide Toolbar"
          command={toggleToolbar}
          icon="caret-up"
          hidden // enable this once there's a way to show the toolbar again
        />
      </div>
    </div>
  )
})
