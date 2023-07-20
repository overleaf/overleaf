import { ReviewPanelChangeEntry } from '../../../../../../../types/review-panel/entry'
import { DocId } from '../../../../../../../types/project-settings'
import {
  ReviewPanelPermissions,
  ReviewPanelUser,
  ThreadId,
} from '../../../../../../../types/review-panel/review-panel'

export interface BaseChangeEntryProps
  extends Pick<ReviewPanelChangeEntry, 'content' | 'offset' | 'focused'> {
  docId: DocId
  entryId: ThreadId
  permissions: ReviewPanelPermissions
  user: ReviewPanelUser | undefined
  timestamp: ReviewPanelChangeEntry['metadata']['ts']
  contentLimit?: number
  entryIds: ReviewPanelChangeEntry['entry_ids']
  onMouseEnter?: () => void
  onMouseLeave?: () => void
  onIndicatorClick?: () => void
}
