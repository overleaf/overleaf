import ReactDOM from 'react-dom'
import { useCodeMirrorViewContext } from '../../source-editor/components/codemirror-editor'
import { memo } from 'react'
import ReviewPanel from './review-panel'
import { useLayoutContext } from '@/shared/context/layout-context'
import { useRangesContext } from '../context/ranges-context'

function ReviewPanelContainer() {
  const view = useCodeMirrorViewContext()
  const ranges = useRangesContext()
  const { reviewPanelOpen } = useLayoutContext()

  const mini = !reviewPanelOpen && !!ranges?.total

  if (!view || (!reviewPanelOpen && !mini)) {
    return null
  }

  return ReactDOM.createPortal(<ReviewPanel mini={mini} />, view.scrollDOM)
}

export default memo(ReviewPanelContainer)
