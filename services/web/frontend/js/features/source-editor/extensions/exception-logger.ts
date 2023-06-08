import { Extension } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { captureException } from '../../../infrastructure/error-reporter'

/**
 * A custom extension which configures the EditorView.exceptionSink facet
 * so that exceptions are sent to Sentry with a `cm6-exception` tag.
 */
export const exceptionLogger = (): Extension => {
  return EditorView.exceptionSink.of(exception => {
    captureException(exception, {
      tags: { handler: 'cm6-exception' },
    })
  })
}
