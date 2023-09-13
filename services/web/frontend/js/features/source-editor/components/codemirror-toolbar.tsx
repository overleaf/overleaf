import { memo, useCallback, useEffect, useRef, useState } from 'react'
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
import EditorSwitch from './editor-switch'
import SwitchToPDFButton from './switch-to-pdf-button'
import { DetacherSynctexControl } from '../../pdf-preview/components/detach-synctex-control'
import DetachCompileButtonWrapper from '../../pdf-preview/components/detach-compile-button-wrapper'
import getMeta from '../../../utils/meta'
import { isVisual } from '../extensions/visual/visual'
import { language } from '@codemirror/language'
import { minimumListDepthForSelection } from '../utils/tree-operations/ancestors'

export const CodeMirrorToolbar = () => {
  const view = useCodeMirrorViewContext()
  const panel = getPanel(view, createToolbarPanel)

  if (!panel) {
    return null
  }

  return createPortal(<Toolbar />, panel.dom)
}

const Toolbar = memo(function Toolbar() {
  const showSourceToolbar: boolean = getMeta('ol-showSourceToolbar')

  const state = useCodeMirrorStateContext()
  const view = useCodeMirrorViewContext()

  const [overflowed, setOverflowed] = useState(false)
  const [collapsed, setCollapsed] = useState(false)

  const overflowedItemsRef = useRef<Set<string>>(new Set())

  const languageName = state.facet(language)?.name
  const visual = isVisual(view)

  const listDepth = minimumListDepthForSelection(state)

  const {
    open: overflowOpen,
    onToggle: setOverflowOpen,
    ref: overflowRef,
  } = useDropdown()

  const buildOverflow = useCallback(
    (element: Element) => {
      setOverflowOpen(false)
      setOverflowed(true)

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
    },
    [setOverflowOpen]
  )

  // calculate overflow when the container resizes
  const { elementRef, resizeRef } = useResizeObserver(buildOverflow)

  // calculate overflow when `languageName` or `visual` change
  useEffect(() => {
    if (resizeRef.current) {
      buildOverflow(resizeRef.current.element)
    }
  }, [buildOverflow, languageName, resizeRef, visual])

  const insideTable = document.activeElement?.closest(
    '.table-generator-help-modal,.table-generator'
  )
  useEffect(() => {
    if (resizeRef.current) {
      buildOverflow(resizeRef.current.element)
    }
  }, [buildOverflow, insideTable, resizeRef])

  const toggleToolbar = useCallback(() => {
    setCollapsed(value => !value)
  }, [])

  if (collapsed) {
    return null
  }

  return (
    <div className="ol-cm-toolbar toolbar-editor" ref={elementRef}>
      {showSourceToolbar && <EditorSwitch />}
      {!insideTable && (
        <ToolbarItems
          state={state}
          languageName={languageName}
          visual={visual}
          listDepth={listDepth}
        />
      )}
      <div className="ol-cm-toolbar-button-group ol-cm-toolbar-stretch">
        {!insideTable && (
          <ToolbarOverflow
            overflowed={overflowed}
            overflowOpen={overflowOpen}
            setOverflowOpen={setOverflowOpen}
            overflowRef={overflowRef}
          >
            <ToolbarItems
              state={state}
              overflowed={overflowedItemsRef.current}
              languageName={languageName}
              visual={visual}
              listDepth={listDepth}
            />
          </ToolbarOverflow>
        )}
        <div className="formatting-buttons-wrapper" />
      </div>
      <div className="ol-cm-toolbar-button-group ol-cm-toolbar-end">
        <ToolbarButton
          id="toolbar-toggle-search"
          label="Toggle Search"
          command={commands.toggleSearch}
          active={searchPanelOpen(state)}
          icon="search"
        />
        {showSourceToolbar && (
          <>
            <SwitchToPDFButton />
            <DetacherSynctexControl />
            <DetachCompileButtonWrapper />
          </>
        )}
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
