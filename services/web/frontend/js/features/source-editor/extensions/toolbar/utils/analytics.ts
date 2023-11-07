import { EditorView } from '@codemirror/view'
import { sendMB } from '../../../../../infrastructure/event-tracking'
import { isVisual } from '../../visual/visual'

export function emitCommandEvent(
  view: EditorView,
  key: string,
  command: string
) {
  const mode = isVisual(view) ? 'visual' : 'source'
  sendMB(key, { command, mode })
}

export function emitToolbarEvent(view: EditorView, command: string) {
  emitCommandEvent(view, 'codemirror-toolbar-event', command)
}
