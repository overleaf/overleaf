import {
  EditorView,
  showTooltip,
  Tooltip,
  TooltipView,
  keymap,
} from '@codemirror/view'
import {
  Extension,
  StateField,
  StateEffect,
  TransactionSpec,
  EditorSelection,
  Prec,
} from '@codemirror/state'
import { closeAllContextMenusEffect } from '../utils/close-all-context-menus-effect'

export const openContextMenuEffect = StateEffect.define<{
  pos: number
  x: number
  y: number
}>()

export const closeContextMenuEffect = StateEffect.define()

type ContextMenuState = {
  tooltip: Tooltip | null
  mousePosition: { x: number; y: number } | null
}

export const contextMenuStateField = StateField.define<ContextMenuState>({
  create() {
    return { tooltip: null, mousePosition: null }
  },

  update(field, tr) {
    let next = field

    // Process effects in order but let open win if present in the same transaction
    for (const effect of tr.effects) {
      if (
        effect.is(closeContextMenuEffect) ||
        effect.is(closeAllContextMenusEffect)
      ) {
        next = { tooltip: null, mousePosition: null }
      }
      if (effect.is(openContextMenuEffect)) {
        const { pos, x, y } = effect.value
        return {
          tooltip: buildContextMenuTooltip(pos, { x, y }),
          mousePosition: { x, y },
        }
      }
    }

    // If effects changed the state, return early so doc-change fallback doesn’t override it
    if (next !== field) {
      return next
    }

    // Close menu on document changes
    if (tr.docChanged && field.tooltip) {
      return { tooltip: null, mousePosition: null }
    }

    return field
  },

  // Connect state field to tooltip system
  provide: field => [
    showTooltip.compute([field], state => state.field(field).tooltip),
  ],
})

function buildContextMenuTooltip(
  pos: number,
  mousePosition: { x: number; y: number }
): Tooltip {
  return {
    pos,
    above: false,
    strictSide: false,
    arrow: false,
    create: () => createTooltipView(mousePosition),
  }
}

const createTooltipView = (mousePosition: {
  x: number
  y: number
}): TooltipView => {
  const dom = document.createElement('div')
  dom.className = 'editor-context-menu-container'

  // Watch for size changes and reposition accordingly
  const resizeObserver = new ResizeObserver(() => {
    requestAnimationFrame(() => positionMenu(dom, mousePosition))
  })
  resizeObserver.observe(dom)

  return {
    dom,
    overlap: true,
    offset: { x: 0, y: 0 },
    destroy() {
      resizeObserver.disconnect()
    },
  }
}

function positionMenu(
  dom: HTMLElement,
  mousePosition: { x: number; y: number }
) {
  const bounds = dom.getBoundingClientRect()

  // Wait for menu to render
  if (bounds.width === 0 || bounds.height === 0) {
    return
  }

  const viewportWidth = window.innerWidth
  const viewportHeight = window.innerHeight
  const y = mousePosition.y

  // Adjust horizontal position if menu would overflow right edge
  let left = mousePosition.x
  if (mousePosition.x + bounds.width > viewportWidth) {
    left = viewportWidth - bounds.width
  }
  dom.style.setProperty('--context-menu-left', `${left}px`)
  const spaceBelow = viewportHeight - y
  let top = y
  if (bounds.height > spaceBelow) {
    // Show above if menu won't fit below
    top = y - bounds.height
  }

  dom.style.setProperty('--context-menu-top', `${top}px`)
}

function isPositionInsideSelection(pos: number, from: number, to: number) {
  return from !== to && pos >= from && pos <= to
}

function isPositionInsideAnyRangeOrCursor(view: EditorView, pos: number) {
  for (const range of view.state.selection.ranges) {
    // If it's a cursor, treat a right-click anywhere on the same line as "inside".
    // This avoids collapsing multi-cursor selections when right-clicking on blank lines
    // or to the right of the caret.
    if (range.from === range.to) {
      const clickedLine = view.state.doc.lineAt(pos)
      const cursorLine = view.state.doc.lineAt(range.from)
      if (clickedLine.number === cursorLine.number) {
        return true
      }
      continue
    }

    if (isPositionInsideSelection(pos, range.from, range.to)) {
      return true
    }
  }
  return false
}

function selectEntireLine(
  view: EditorView,
  pos: number
): EditorSelection | null {
  if (pos === null) {
    return null
  }

  const line = view.state.doc.lineAt(pos)
  return EditorSelection.single(line.from, line.to)
}

function closeContextMenu(view: EditorView): void {
  const menuState = view.state.field(contextMenuStateField, false)
  if (menuState?.tooltip) {
    view.dispatch({ effects: closeContextMenuEffect.of(null) })
  }
}

function openContextMenuAtPosition(
  view: EditorView,
  pos: number,
  selection: EditorSelection | TransactionSpec['selection'],
  clientX: number,
  clientY: number
): void {
  view.dispatch({
    selection,
    effects: [
      closeAllContextMenusEffect.of(null),
      openContextMenuEffect.of({
        pos,
        x: clientX,
        y: clientY,
      }),
    ],
  })
}

function openContextMenuAtSelection(view: EditorView): boolean {
  const { main } = view.state.selection
  const pos = main.head
  const coords = view.coordsAtPos(pos)
  if (!coords) {
    return false
  }

  // Keep the current selection; actions should apply to it
  const selection = view.state.selection

  openContextMenuAtPosition(view, pos, selection, coords.left, coords.top)
  return true
}

function isClickOnGutter(target: HTMLElement): boolean {
  return !!target.closest('.cm-gutters')
}

// Gutter context menu plugin
const gutterContextMenuPlugin = (): Extension =>
  EditorView.updateListener.of(update => {
    if (!update.view.dom.parentElement) {
      return
    }

    const gutters = update.view.dom.parentElement.querySelector('.cm-gutters')
    // Attach listener only once per editor instance
    if (!gutters || gutters.hasAttribute('data-context-menu-attached')) {
      return
    }

    gutters.setAttribute('data-context-menu-attached', 'true')
    gutters.addEventListener('contextmenu', (event: Event) => {
      const mouseEvent = event as MouseEvent
      event.preventDefault()

      const pos = update.view.posAtCoords({
        x: mouseEvent.clientX,
        y: mouseEvent.clientY,
      })
      if (pos === null) {
        return
      }

      const selection = selectEntireLine(update.view, pos)
      if (selection) {
        openContextMenuAtPosition(
          update.view,
          pos,
          selection,
          mouseEvent.clientX,
          mouseEvent.clientY
        )
      }
    })
  })

// Editor view context menu handlers
const editorContextMenuHandlers = (): Extension =>
  EditorView.domEventHandlers({
    contextmenu(event: MouseEvent, view: EditorView) {
      event.preventDefault()

      const pos = view.posAtCoords({ x: event.clientX, y: event.clientY })
      if (pos === null) {
        return false
      }

      const clickedInsideSelection = isPositionInsideAnyRangeOrCursor(view, pos)

      // Set cursor to clicked position if outside selection
      let selection: TransactionSpec['selection'] = { anchor: pos }
      if (clickedInsideSelection) {
        // Keep current selection if inside selection
        // so actions apply to the existing selection
        selection = view.state.selection
      }

      openContextMenuAtPosition(
        view,
        pos,
        selection,
        event.clientX,
        event.clientY
      )
      return true
    },

    mousedown(event: MouseEvent, view: EditorView) {
      const target = event.target as HTMLElement
      const isGutter = isClickOnGutter(target)
      const isRightClick = event.button === 2 || event.ctrlKey

      // Close menu on any click except right-click on non-gutter
      if (!isRightClick || isGutter) {
        closeContextMenu(view)
      }

      // Prevent default on right-click to preserve selection
      if (isRightClick) {
        event.preventDefault()
        return true
      }
      return false
    },
  })

// High-priority keymap to handle Escape before default handlers
const contextMenuKeymap = (): Extension =>
  Prec.high(
    keymap.of([
      {
        key: 'Escape',
        run: view => {
          const menuState = view.state.field(contextMenuStateField, false)
          if (menuState?.tooltip) {
            closeContextMenu(view)
            return true
          }
          return false
        },
      },
      {
        key: 'Shift-F10',
        // Accessibility standard shortcut to open context menu
        run: view => openContextMenuAtSelection(view),
      },
    ])
  )

export const contextMenu = (enabled: boolean): Extension =>
  enabled
    ? [
        contextMenuContainerTheme,
        contextMenuStateField,
        gutterContextMenuPlugin(),
        editorContextMenuHandlers(),
        contextMenuKeymap(),
      ]
    : []

const contextMenuContainerTheme = EditorView.baseTheme({
  '.editor-context-menu-container.cm-tooltip': {
    backgroundColor: 'transparent',
    border: 'none',
    zIndex: 100,
    position: 'fixed !important',
    top: 'var(--context-menu-top) !important',
    left: 'var(--context-menu-left) !important',
  },
})
