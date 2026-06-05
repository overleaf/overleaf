import ReactDOM from 'react-dom'
import { useCodeMirrorViewContext } from '../../source-editor/components/codemirror-context'
import { memo } from 'react'
import ReviewPanel from './review-panel'
import ReviewModeSwitcher from './review-mode-switcher'
import useReviewPanelLayout from '../hooks/use-review-panel-layout'
import { useLayoutContext } from '@/shared/context/layout-context'

function ReviewPanelContainer() {
  const view = useCodeMirrorViewContext()
  const { showPanel, mini } = useReviewPanelLayout()
  const { focusMode } = useLayoutContext()

  if (!view) {
    return null
  }

  return ReactDOM.createPortal(
    <>
      {!focusMode && <ReviewModeSwitcher />}
      {showPanel && <ReviewPanel mini={mini} />}
    </>,
    view.scrollDOM
  )
}

export default memo(ReviewPanelContainer)
