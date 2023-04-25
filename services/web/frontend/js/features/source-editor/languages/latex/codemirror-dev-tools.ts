import {
  Annotation,
  Compartment,
  EditorSelection,
  EditorState,
  StateEffect,
  StateField,
  Transaction,
} from '@codemirror/state'
import {
  Decoration,
  DecorationSet,
  EditorView,
  ViewPlugin,
} from '@codemirror/view'
import { syntaxTree } from '@codemirror/language'
import { toggleVisualEffect } from '../../extensions/visual/visual'
import { hasLanguageLoadedEffect } from '../../extensions/language'
import customLocalStorage from '../../../../infrastructure/local-storage'

// to enable: window.localStorage.setItem('cm6-dev-tools', '"on"')
// to disable: window.localStorage.removeItem('cm6-dev-tools')
const enabled = customLocalStorage.getItem('cm6-dev-tools') === 'on'

const devToolsConf = new Compartment()

export const codemirrorDevTools = () => {
  return enabled ? [devToolsButton, devToolsConf.of(createExtension())] : []
}

const devToolsButton = ViewPlugin.define(view => {
  const getContainer = () =>
    document.querySelector('.formatting-buttons-wrapper')

  const removeButton = () => {
    getContainer()?.querySelector('#cm6-dev-tools-button')?.remove()
  }

  const addButton = () => {
    const button = document.createElement('button')
    button.classList.add('btn', 'formatting-btn', 'formatting-btn--icon')
    button.id = 'cm6-dev-tools-button'
    button.textContent = '🦧'
    button.addEventListener('click', event => {
      event.preventDefault()
      view.dispatch(toggleDevTools())
    })

    getContainer()?.prepend(button)
  }

  removeButton()
  addButton()

  return {
    update(update) {
      for (const tr of update.transactions) {
        for (const effect of tr.effects) {
          if (effect.is(toggleVisualEffect)) {
            window.setTimeout(() => {
              removeButton()
              addButton()
            })
          }
        }
      }
    },
    destroy() {
      removeButton()
    },
  }
})

const isActive = () =>
  customLocalStorage.getItem('cm6-dev-tools-active') === 'on'

const toggleDevTools = () => {
  customLocalStorage.setItem('cm6-dev-tools-active', isActive() ? 'off' : 'on')

  return {
    effects: devToolsConf.reconfigure(createExtension()),
  }
}

const createExtension = () =>
  isActive() ? [devToolsView, highlightSelectedNode, devToolsTheme] : []

const devToolsTheme = EditorView.baseTheme({
  '.ol-cm-dev-tools-container': {
    padding: '8px 8px 0',
    backgroundColor: '#222',
    color: '#eee',
    fontSize: '13px',
    flexShrink: '0',
    fontFamily: '"SF Mono", monospace',
    height: '100%',
    overflow: 'auto',
    position: 'sticky',
    top: 0,
  },
  '.ol-cm-dev-tools-item': {
    cursor: 'pointer',
    borderTop: '2px solid transparent',
    borderBottom: '2px solid transparent',
    scrollMargin: '2em',
  },
  '.ol-cm-selected-node-highlight': {
    backgroundColor: 'yellow',
  },
  '.ol-cm-dev-tools-covered-item': {
    backgroundColor: 'rgba(255, 255, 0, 0.2)',
  },
  '.ol-cm-dev-tools-selected-item': {
    backgroundColor: 'rgba(255, 255, 0, 0.5)',
    color: '#000',
  },
  '.ol-cm-dev-tools-cursor-before': {
    borderTopColor: 'rgba(255, 255, 0, 1)',
    '& + .ol-cm-dev-tools-cursor-before': {
      borderTopColor: 'transparent',
    },
  },
  '.ol-cm-dev-tools-positions': {
    position: 'sticky',
    bottom: '0',
    backgroundColor: 'inherit',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  '.ol-cm-dev-tools-position': {
    padding: '4px 0',
  },
})

const fromDevTools = Annotation.define()

const transactionIsFromDevTools = (tr: Transaction) =>
  tr.annotation(fromDevTools)

const devToolsView = ViewPlugin.define(view => {
  const scroller = document.querySelector<HTMLDivElement>('.cm-scroller')

  if (!scroller) {
    return {}
  }

  const container = document.createElement('div')
  container.classList.add('ol-cm-dev-tools-container')
  scroller.append(container)

  const highlightNodeRange = (from: number, to: number) => {
    view.dispatch({
      effects: [selectedNodeEffect.of({ from, to })],
    })
  }

  const selectNodeRange = (from: number, to: number) => {
    view.dispatch({
      annotations: [fromDevTools.of(true)],
      selection: EditorSelection.single(from, to),
      effects: EditorView.scrollIntoView(from, { y: 'center' }),
    })
    view.focus()
  }

  buildPanel(view.state, container, highlightNodeRange, selectNodeRange, true)

  return {
    update(update) {
      if (
        update.docChanged ||
        update.selectionSet ||
        hasLanguageLoadedEffect(update)
      ) {
        const scroll = !update.transactions.some(transactionIsFromDevTools)
        buildPanel(
          update.state,
          container,
          highlightNodeRange,
          selectNodeRange,
          scroll
        )
      }
    },
    destroy() {
      container.remove()
    },
  }
})

const buildPanel = (
  state: EditorState,
  container: HTMLDivElement,
  highlightNodeRange: (from: number, to: number) => void,
  selectNodeRange: (from: number, to: number) => void,
  scroll: boolean
) => {
  container.textContent = '' // clear

  const tree = syntaxTree(state)
  const { selection } = state
  let itemToCenter: HTMLDivElement

  let depth = 0
  tree.iterate({
    enter(nodeRef) {
      const { from, to, name } = nodeRef

      const element = document.createElement('div')
      element.classList.add('ol-cm-dev-tools-item')
      element.style.paddingLeft = `${depth * 16}px`
      element.textContent = name

      element.addEventListener('mouseover', () => {
        highlightNodeRange(from, to)
      })

      element.addEventListener('click', () => {
        selectNodeRange(from, to)
      })

      container.append(element)

      for (const range of selection.ranges) {
        // completely covered by selection
        if (range.from <= from && range.to >= to) {
          element.classList.add('ol-cm-dev-tools-selected-item')
          itemToCenter = element
        } else if (
          (range.from > from && range.from < to) ||
          (range.to > from && range.to < to)
        ) {
          element.classList.add('ol-cm-dev-tools-covered-item')
          itemToCenter = element
        }

        if (range.head === from) {
          element.classList.add('ol-cm-dev-tools-cursor-before')
          itemToCenter = element
        }
      }
      depth++
    },
    leave(node) {
      depth--
    },
  })

  const positions = document.createElement('div')
  positions.classList.add('ol-cm-dev-tools-positions')
  container.append(positions)

  for (const range of state.selection.ranges) {
    const line = state.doc.lineAt(range.head)
    const column = range.head - line.from + 1
    const position = document.createElement('div')
    position.classList.add('ol-cm-dev-tools-position')
    position.textContent = `line ${line.number}, col ${column}, pos ${range.head}`
    positions.append(position)
  }

  if (scroll && itemToCenter!) {
    window.setTimeout(() => {
      itemToCenter.scrollIntoView({
        block: 'center',
        inline: 'center',
      })
    })
  }
}

const selectedNodeEffect = StateEffect.define<{
  from: number
  to: number
} | null>()

const highlightSelectedNode = StateField.define<DecorationSet>({
  create() {
    return Decoration.none
  },
  update(value, tr) {
    if (tr.selection) {
      value = Decoration.none
    }
    for (const effect of tr.effects) {
      if (effect.is(selectedNodeEffect)) {
        if (effect.value) {
          const { from, to } = effect.value

          // TODO: widget decoration if no range to decorate?
          if (to > from) {
            value = Decoration.set([
              Decoration.mark({
                class: 'ol-cm-selected-node-highlight',
              }).range(from, to),
            ])
          }
        } else {
          value = Decoration.none
        }
      }
    }
    return value
  },
  provide(f) {
    return EditorView.decorations.from(f)
  },
})
