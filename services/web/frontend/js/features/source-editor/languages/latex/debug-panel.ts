import { Decoration, EditorView, Panel, showPanel } from '@codemirror/view'
import { languageLoadedEffect } from '../../extensions/language'
import { Compartment, EditorState } from '@codemirror/state'
import { getAncestorStack } from '../../utils/tree-query'
import { resolveNodeAtPos } from '../../utils/tree-operations/common'

const decorationsConf = new Compartment()

export const debugPanel = () => {
  const enableDebugPanel = new URLSearchParams(window.location.search).has(
    'cm_debug_panel'
  )

  if (!enableDebugPanel) {
    return []
  }

  return [
    showPanel.of(createInfoPanel),

    decorationsConf.of(EditorView.decorations.of(Decoration.none)),

    // clear the highlight when the selection changes
    EditorView.updateListener.of(update => {
      if (update.selectionSet) {
        update.view.dispatch({
          effects: decorationsConf.reconfigure(
            EditorView.decorations.of(Decoration.none)
          ),
        })
      }
    }),

    EditorView.baseTheme({
      '.ol-cm-debug-panel': {
        paddingBottom: '24px',
      },
      '.ol-cm-debug-panel-type': {
        backgroundColor: '#138a07',
        color: '#fff',
        padding: '0px 4px',
        marginLeft: '4px',
        borderRadius: '4px',
      },
      '.ol-cm-debug-panel-item': {
        border: 'none',
        backgroundColor: '#fff',
        color: '#000',
        outline: '1px solid transparent',
        marginBottom: '2px',
        display: 'inline-flex',
        alignItems: 'center',
        '&:hover': {
          outlineColor: '#000',
        },
      },
      '.ol-cm-debug-panel-position': {
        position: 'absolute',
        bottom: '0',
        right: '0',
        padding: '5px',
      },
      '.ol-cm-debug-panel-node-highlight': {
        backgroundColor: '#ffff0077',
      },
    }),
  ]
}

const placeholder = () => document.createElement('div')

const createInfoPanel = (view: EditorView): Panel => {
  const dom = document.createElement('div')
  dom.className = 'ol-cm-debug-panel'
  dom.append(buildPanelContent(view, view.state))

  return {
    dom,
    update(update) {
      if (update.selectionSet) {
        // update when the selection changes
        dom.firstChild!.replaceWith(
          buildPanelContent(update.view, update.state)
        )
      } else {
        // update when the language is loaded
        for (const tr of update.transactions) {
          if (tr.effects.some(effect => effect.is(languageLoadedEffect))) {
            dom.firstChild!.replaceWith(
              buildPanelContent(update.view, update.state)
            )
          }
        }
      }
    },
  }
}

const buildPanelContent = (
  view: EditorView,
  state: EditorState
): HTMLDivElement => {
  const pos = state.selection.main.anchor
  const ancestors = getAncestorStack(state, pos)

  if (!ancestors) {
    return placeholder()
  }

  if (ancestors.length > 0) {
    const node = ancestors[ancestors.length - 1]
    const nodeBefore = resolveNodeAtPos(state, pos, -1)
    const nodeAfter = resolveNodeAtPos(state, pos, 1)

    const parts = []
    if (nodeBefore) {
      parts.push(`[${nodeBefore.name}]`)
    }
    parts.push(node.label)
    if (nodeAfter) {
      parts.push(`[${nodeAfter.name}]`)
    }
    node.label = parts.join(' ')
  }

  const panelContent = document.createElement('div')
  panelContent.style.padding = '5px 10px'

  const line = state.doc.lineAt(pos)
  const column = pos - line.from + 1
  const positionContainer = document.createElement('div')
  positionContainer.className = 'ol-cm-debug-panel-position'
  positionContainer.textContent = `line ${line.number}, col ${column}, pos ${pos}`
  panelContent.appendChild(positionContainer)

  const stackContainer = document.createElement('div')
  for (const [index, item] of ancestors.entries()) {
    if (index > 0) {
      stackContainer.append(' > ')
    }
    const element = document.createElement('button')
    element.className = 'ol-cm-debug-panel-item'

    const label = document.createElement('span')
    label.className = 'ol-cm-debug-panel-label'
    label.textContent = item.label
    element.append(label)

    if (item.type) {
      const type = document.createElement('span')
      type.className = 'ol-cm-debug-panel-type'
      type.textContent = item.type
      element.append(type)
    }

    element.addEventListener('click', () => {
      view.dispatch({
        effects: [
          decorationsConf.reconfigure(
            EditorView.decorations.of(
              Decoration.set(
                Decoration.mark({
                  class: 'ol-cm-debug-panel-node-highlight',
                }).range(item.from, item.to)
              )
            )
          ),
          EditorView.scrollIntoView(item.from, { y: 'center' }),
        ],
      })
    })

    stackContainer.append(element)
  }
  panelContent.appendChild(stackContainer)

  return panelContent
}
