import { FC } from 'react'
import { createPortal } from 'react-dom'
import ReviewPanelHeader from './review-panel-header'
import { useTabsContext } from '@/features/ide-react/context/tabs-context'
import { useFeatureFlag } from '@/shared/context/split-test-context'
import useReviewPanelLayout from '../hooks/use-review-panel-layout'

const ReviewPanelTabsHeaderPortal: FC = () => {
  const editorTabsEnabled = useFeatureFlag('editor-tabs')
  const { headerSlot } = useTabsContext()
  const { showHeader } = useReviewPanelLayout()

  if (!editorTabsEnabled || !headerSlot || !showHeader) {
    return null
  }

  return createPortal(<ReviewPanelHeader />, headerSlot)
}

export default ReviewPanelTabsHeaderPortal
