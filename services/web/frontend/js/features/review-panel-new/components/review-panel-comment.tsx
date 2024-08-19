import { memo } from 'react'
import { Change, CommentOperation } from '../../../../../types/change'
import { useThreadsContext } from '../context/threads-context'
import classnames from 'classnames'
import { ReviewPanelEntry } from './review-panel-entry'
import MaterialIcon from '@/shared/components/material-icon'
import { ReviewPanelCommentContent } from './review-panel-comment-content'

export const ReviewPanelComment = memo<{
  comment: Change<CommentOperation>
  top?: number
}>(({ comment, top }) => {
  const threads = useThreadsContext()

  const thread = threads?.[comment.op.t]
  if (!thread || thread.resolved) {
    return null
  }

  return (
    <ReviewPanelEntry
      className={classnames('review-panel-entry-comment', {
        'review-panel-entry-loaded': !!threads?.[comment.op.t],
      })}
      top={top}
      op={comment.op}
      position={comment.op.p}
    >
      <div className="review-panel-entry-indicator">
        <MaterialIcon type="edit" className="review-panel-entry-icon" />
      </div>
      <ReviewPanelCommentContent comment={comment} isResolved={false} />
    </ReviewPanelEntry>
  )
})
ReviewPanelComment.displayName = 'ReviewPanelComment'
