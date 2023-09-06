import { EditorView } from '@codemirror/view'
import { emitCommandEvent } from '../../extensions/toolbar/utils/analytics'

export function emitTableGeneratorEvent(view: EditorView, command: string) {
  emitCommandEvent(view, 'codemirror-table-generator-event', command)
}
