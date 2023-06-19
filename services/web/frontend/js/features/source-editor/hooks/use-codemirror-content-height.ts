import { EditorView } from '@codemirror/view'
import useCodeMirrorMeasurement from './use-codemirror-measurement'

// view.contentHeight, which is measured for us by CodeMirror and is what the
// gutters use, is sometimes a pixel or so short of the full height of the
// editor content, which leaves a small gap at the bottom, so use the DOM
// scrollHeight property instead.
const measureContentHeight = (view: EditorView) => view.contentDOM.scrollHeight

export default function useCodeMirrorContentHeight() {
  return useCodeMirrorMeasurement('content-height', measureContentHeight)
}
