import { Compartment, type Extension } from '@codemirror/state'
import CodeMirror, { CodeMirrorVim } from './bundle'
import { ViewPlugin } from '@codemirror/view'

const thirdPartyExtensionsConf = new Compartment()

const dispatchEvent = (extensions: Extension[]) => {
  window.dispatchEvent(
    new CustomEvent('UNSTABLE_editor:extensions', {
      detail: { CodeMirror, CodeMirrorVim, extensions },
    })
  )
}

/**
 * A custom extension that allows additional CodeMirror extensions to be provided by external code,
 * e.g. browser extensions.
 */
export const thirdPartyExtensions = (): Extension => {
  const extensions: Extension[] = []

  dispatchEvent(extensions)

  Object.defineProperty(window, 'UNSTABLE_editorHelp', {
    writable: false,
    enumerable: true,
    value: `
Listen for the UNSTABLE_editor:extensions event to add your CodeMirror 6
extension(s) to the extensions array. Use the exported objects to avoid
instanceof comparison errors.

Open an issue on http://github.com/overleaf/overleaf if you think more
should be exported.

This API is **unsupported** and subject to change without warning.

Example:

window.addEventListener("UNSTABLE_editor:extensions", function(evt) {
  const { CodeMirror, extensions } = evt.detail;

  // CodeMirror contains exported objects from the CodeMirror instance
  const { EditorSelection, ViewPlugin } = CodeMirror;

  // ...

  // Any custom extensions should be pushed to the \`extensions\` array
  extensions.push(myCustomExtension)
});`,
  })

  return [thirdPartyExtensionsConf.of(extensions), extensionLoaded]
}

const extensionLoaded = ViewPlugin.define(view => {
  const listener = () => {
    const extensions: Extension[] = []

    dispatchEvent(extensions)

    view.dispatch({
      effects: thirdPartyExtensionsConf.reconfigure(extensions),
    })
  }

  window.addEventListener('editor:extension-loaded', listener)

  return {
    destroy() {
      window.removeEventListener('editor:extension-loaded', listener)
    },
  }
})
