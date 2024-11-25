import { EditorView } from '@codemirror/view'
import { sendMB } from '../../../../../infrastructure/event-tracking'
import { isVisual } from '../../visual/visual'

export function emitCommandEvent(
  view: EditorView,
  key: string,
  command: string,
  segmentation?: Record<string, string | number | boolean>
) {
  const mode = isVisual(view) ? 'visual' : 'source'
  sendMB(key, { command, mode, ...segmentation })
}

export function emitToolbarEvent(view: EditorView, command: string) {
  emitCommandEvent(view, 'codemirror-toolbar-event', command)
}

export function emitShortcutEvent(
  view: EditorView,
  command: string,
  segmentation?: Record<string, string | number | boolean>
) {
  emitCommandEvent(view, 'codemirror-shortcut-event', command, segmentation)
}
