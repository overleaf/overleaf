import { useCallback, useState } from 'react'
import { useCodeMirrorViewContext } from '../components/codemirror-editor'
import { EditorView } from '@codemirror/view'
import useEventListener from '../../../shared/hooks/use-event-listener'

export default function useCodeMirrorMeasurement(
  key: string,
  measure: (view: EditorView) => number
) {
  const view = useCodeMirrorViewContext()
  const [measurement, setMeasurement] = useState(measure(view))

  useEventListener(
    'editor:geometry-change',
    useCallback(() => {
      view.requestMeasure({
        key,
        read: () => measure(view),
        write(value) {
          setMeasurement(value)
        },
      })
    }, [view, measure, key])
  )

  return measurement
}
