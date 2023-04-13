import { Extension } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { captureException } from '../../../infrastructure/error-reporter'

export const exceptionLogger = (): Extension => {
  return EditorView.exceptionSink.of(exception => {
    captureException(exception, {
      tags: { handler: 'cm6-exception' },
    })
  })
}
