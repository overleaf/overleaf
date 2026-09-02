import React, {
  ComponentType,
  FC,
  memo,
  useEffect,
  useRef,
  useState,
} from 'react'
import ReactDOM from 'react-dom'
import classNames from 'classnames'
import { getTooltip } from '@codemirror/view'
import { EditorState } from '@codemirror/state'
import importOverleafModules from '../../../macros/import-overleaf-module.macro'
import {
  useCodeMirrorStateContext,
  useCodeMirrorViewContext,
} from '@/features/source-editor/components/codemirror-context'
import { reviewTooltipField } from '@/features/source-editor/extensions/review-tooltip'
import usePreviousValue from '@/shared/hooks/use-previous-value'
import { useLayoutContext } from '@/shared/context/layout-context'
import { useEditorPropertiesContext } from '@/features/ide-react/context/editor-properties-context'
import AddCommentAction from './components/add-comment-action'
import TrackedChangesActions from './components/tracked-changes-actions'

const TOOLTIP_SHOW_DELAY = 120

// The document position on the visual bottom line of the selection, so the menu
// anchors to the last line regardless of drag direction. If the selection ends
// at column 0 of a multi-line selection, the bottom line is the previous one.
function selectionBottomLinePos(state: EditorState) {
  const { from, to } = state.selection.main
  const lineAtTo = state.doc.lineAt(to)
  return lineAtTo.from === to && to > from ? to - 1 : to
}

// Each default-exports a self-gating component.
const editorFloatingMenuActions = importOverleafModules(
  'editorFloatingMenuActions'
) as { import: { default: ComponentType }; path: string }[]

const EditorFloatingMenu: FC = () => {
  const state = useCodeMirrorStateContext()
  const view = useCodeMirrorViewContext()
  const { focusMode } = useLayoutContext()
  const [show, setShow] = useState(true)
  const tooltipState = state.field(reviewTooltipField, false)
  const previousTooltipState = usePreviousValue(tooltipState)

  useEffect(() => {
    if (tooltipState !== null && previousTooltipState === null) {
      setShow(true)
    }
  }, [tooltipState, previousTooltipState])

  useEffect(() => {
    if (!show || !tooltipState) {
      return
    }
    const handleMouseDown = (event: MouseEvent) => {
      const target = event.target as Element | null
      if (
        !view.contentDOM.contains(target) &&
        !target?.closest?.('.review-tooltip-menu-container') &&
        !target?.closest?.('.modal') &&
        !target?.closest?.('.modal-backdrop')
      ) {
        setShow(false)
      }
    }
    document.addEventListener('mousedown', handleMouseDown)
    return () => {
      document.removeEventListener('mousedown', handleMouseDown)
    }
  }, [show, tooltipState, view])

  if (focusMode || !show || !tooltipState) {
    return null
  }

  const tooltipView = getTooltip(view, tooltipState)

  if (!tooltipView) {
    return null
  }

  return ReactDOM.createPortal(<EditorFloatingMenuContent />, tooltipView.dom)
}

const EditorFloatingMenuContent = memo(function EditorFloatingMenuContent() {
  const view = useCodeMirrorViewContext()
  const { reviewPanelOpen } = useLayoutContext()
  const { wantTrackChanges } = useEditorPropertiesContext()
  const [visible, setVisible] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const measure = () => {
      view.requestMeasure({
        key: 'editor-floating-menu-position',
        read(view) {
          // lineBlockAt returns a position even when the line isn't rendered on screen.
          // documentTop shifts it to viewport coordinates.
          const block = view.lineBlockAt(selectionBottomLinePos(view.state))
          // Anchor to the line's last visual row so a wrapped line pins to its
          // bottom, not its middle so that menus do not cover content.
          const lineBottomY = view.documentTop + block.bottom
          const lineCenterY = lineBottomY - view.defaultLineHeight / 2

          const menuHeight =
            menuRef.current?.getBoundingClientRect().height ?? 0
          const scrollDomRect = view.scrollDOM.getBoundingClientRect()
          const contentDomRect = view.contentDOM.getBoundingClientRect()

          // Centre on the bottom row, but keep the menu pinned inside the
          // editor viewport so it never scrolls out of view: when the anchored
          // line leaves the top or bottom edge the menu rides that edge instead.
          const top = Math.min(
            Math.max(lineCenterY - menuHeight / 2, scrollDomRect.top),
            scrollDomRect.bottom - menuHeight
          )

          return {
            position: 'fixed' as const,
            top,
            right: window.innerWidth - contentDomRect.left,
          }
        },
        // Mutate the DOM directly rather than via state to avoid re-rendering
        // on every scroll frame.
        write(res) {
          const el = menuRef.current
          if (!el || !res) return
          el.style.position = res.position
          el.style.top = `${res.top}px`
          el.style.right = `${res.right}px`
        },
      })
    }

    measure()

    // Re-center when the menu's own height changes (e.g. tracked-change
    // actions appear/disappear).
    const observer = new ResizeObserver(measure)
    if (menuRef.current) {
      observer.observe(menuRef.current)
    }
    // The scroller's box tracks the editor pane, so this catches pane/window
    // resizes. It doesn't fire on scroll, hence the separate scroll listener.
    observer.observe(view.scrollDOM)

    // Track the cursor as the editor scrolls.
    view.scrollDOM.addEventListener('scroll', measure)

    return () => {
      observer.disconnect()
      view.scrollDOM.removeEventListener('scroll', measure)
    }
  }, [view, reviewPanelOpen, wantTrackChanges])

  useEffect(() => {
    setVisible(false)
    const timeout = setTimeout(() => {
      setVisible(true)
    }, TOOLTIP_SHOW_DELAY)

    return () => {
      clearTimeout(timeout)
    }
  }, [])

  return (
    <div
      ref={menuRef}
      className={classNames('editor-floating-menu', {
        'editor-floating-menu-visible': visible,
      })}
    >
      <AddCommentAction />
      <TrackedChangesActions />
      {editorFloatingMenuActions.map(
        ({ import: { default: Component }, path }) => (
          <React.Fragment key={path}>
            <div className="editor-floating-menu-divider" />
            <Component />
          </React.Fragment>
        )
      )}
    </div>
  )
})

export default EditorFloatingMenu
