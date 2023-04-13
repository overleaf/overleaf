import type { Extension } from '@codemirror/state'
import CodeMirror, { CodeMirrorVim } from './bundle'

export const thirdPartyExtensions = (): Extension => {
  const extensions: Extension[] = []

  window.dispatchEvent(
    new CustomEvent('UNSTABLE_editor:extensions', {
      detail: { CodeMirror, CodeMirrorVim, extensions },
    })
  )

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

  return extensions
}
