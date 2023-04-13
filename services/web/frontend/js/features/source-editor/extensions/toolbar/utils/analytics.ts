import { EditorView } from '@codemirror/view'
import { sendMB } from '../../../../../infrastructure/event-tracking'
import { isVisual } from '../../visual/visual'

export function emitCommandEvent(view: EditorView, command: string) {
  const mode = isVisual(view) ? 'visual' : 'source'
  sendMB('codemirror-toolbar-event', { command, mode })
}
