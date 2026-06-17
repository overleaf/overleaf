import ReactDOM from 'react-dom'
import { useCodeMirrorViewContext } from '../../source-editor/components/codemirror-context'
import { memo } from 'react'
import ReviewPanel from './review-panel'
import ReviewModeSwitcher from './review-mode-switcher'
import useReviewPanelLayout from '../hooks/use-review-panel-layout'
import { useLayoutContext } from '@/shared/context/layout-context'
import { useFeatureFlag } from '@/shared/context/split-test-context'

function ReviewPanelContainer() {
  const view = useCodeMirrorViewContext()
  const { showPanel, mini } = useReviewPanelLayout()
  const { focusMode } = useLayoutContext()
  const isToolbarMigration = useFeatureFlag('writefull-toolbar-migration')

  if (!view) {
    return null
  }

  return ReactDOM.createPortal(
    <>
      {!focusMode && !isToolbarMigration && <ReviewModeSwitcher />}
      {showPanel && <ReviewPanel mini={mini} />}
    </>,
    view.scrollDOM
  )
}

export default memo(ReviewPanelContainer)
