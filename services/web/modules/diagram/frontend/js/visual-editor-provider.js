import customLocalStorage from '@/infrastructure/local-storage'
import DiagramEditor from './components/diagram-editor'

/**
 * Visual-editor provider (Overleaf `visualEditorProviders` hook) for the
 * SVG diagram editor (modules/diagram).
 *
 * When this provider claims a file, Overleaf HIDES the CodeMirror source
 * editor and renders our canvas editor in the full editor pane (this is the
 * "Code | Visual" switch in the editor toolbar). Registering here — instead
 * of `sourceEditorComponents` — is what keeps the canvas from being
 * rendered underneath a full-height CodeMirror editor.
 */

const STORAGE_KEY = 'editor.lastUsedMode.diagram'

// Product default: open SVG documents in the canvas editor. The user can
// switch to code (raw SVG source) at any time; the toggle remembers the
// last-used mode per this storage key.
try {
  if (customLocalStorage.getItem(STORAGE_KEY) === null) {
    customLocalStorage.setItem(STORAGE_KEY, 'visual')
  }
} catch (e) {
  // localStorage unavailable — the Code/Visual toggle still works.
}

export const id = 'diagram'

export function isVisualEditorAvailable(filename) {
  return /\.svg$/i.test(filename || '')
}

export function getVisualEditorComponent(filename) {
  return isVisualEditorAvailable(filename) ? DiagramEditor : null
}
