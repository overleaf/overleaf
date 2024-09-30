import { toggleVisualEffect } from '../../extensions/visual/visual'
import customLocalStorage from '../../../../infrastructure/local-storage'
import { Compartment } from '@codemirror/state'
import { EditorView, ViewPlugin } from '@codemirror/view'
import { treeView } from '@overleaf/codemirror-tree-view'

// to enable: window.localStorage.setItem('cm6-dev-tools', '"on"')
// to disable: window.localStorage.removeItem('cm6-dev-tools')
const enabled = customLocalStorage.getItem('cm6-dev-tools') === 'on'

const devToolsConf = new Compartment()

/**
 * A panel which displays an outline of the current document's syntax tree alongside the document,
 * to assist with CodeMirror extension development.
 */
export const codemirrorDevTools = () => {
  return enabled ? [devToolsButton, devToolsConf.of(createExtension())] : []
}

const devToolsButton = ViewPlugin.define(view => {
  const getContainer = () => document.querySelector('.ol-cm-toolbar-end')

  const removeButton = () => {
    getContainer()?.querySelector('#cm6-dev-tools-button')?.remove()
  }

  const addButton = () => {
    const button = document.createElement('button')
    button.classList.add('btn', 'formatting-btn', 'formatting-btn-icon')
    button.id = 'cm6-dev-tools-button'
    button.textContent = '🦧'
    button.style.border = 'none'
    button.style.outline = 'none'
    button.addEventListener('click', event => {
      event.preventDefault()
      view.dispatch(toggleDevTools())
    })

    getContainer()?.append(button)
  }

  window.setTimeout(() => {
    removeButton()
    addButton()
  })

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

const treeViewTheme = EditorView.baseTheme({
  // note: duplicate selector to ensure extension theme styles are overriden
  '.cm-tree-view-container.cm-tree-view-container': {
    top: '32px',
    minHeight: 'unset',
  },
})

const createExtension = () => (isActive() ? [treeView, treeViewTheme] : [])
