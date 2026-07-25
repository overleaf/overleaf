import { FC } from 'react'
import { createPortal } from 'react-dom'
import ReviewPanelHeader from './review-panel-header'
import { useTabsContext } from '@/features/ide-react/context/tabs-context'
import useReviewPanelLayout from '../hooks/use-review-panel-layout'
import { useAreTabsEnabled } from '@/features/ide-react/hooks/use-are-tabs-enabled'

const ReviewPanelTabsHeaderPortal: FC = () => {
  const editorTabsEnabled = useAreTabsEnabled()
  const { headerSlot } = useTabsContext()
  const { showHeader } = useReviewPanelLayout()

  if (!editorTabsEnabled || !headerSlot || !showHeader) {
    return null
  }

  return createPortal(<ReviewPanelHeader />, headerSlot)
}

export default ReviewPanelTabsHeaderPortal
