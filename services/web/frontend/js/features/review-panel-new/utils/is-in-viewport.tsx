import { EditorView } from '@codemirror/view'
import { Change } from '../../../../../types/change'

export const isInViewport =
  (view: EditorView) =>
  (change: Change): boolean =>
    change.op.p >= view.viewport.from && change.op.p <= view.viewport.to
