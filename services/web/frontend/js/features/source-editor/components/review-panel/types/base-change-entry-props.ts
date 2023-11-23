import { ReviewPanelChangeEntry } from '../../../../../../../types/review-panel/entry'
import { DocId } from '../../../../../../../types/project-settings'
import {
  ReviewPanelUser,
  ThreadId,
} from '../../../../../../../types/review-panel/review-panel'
import { Permissions } from '@/features/ide-react/types/permissions'

export interface BaseChangeEntryProps
  extends Pick<ReviewPanelChangeEntry, 'content' | 'offset' | 'focused'> {
  docId: DocId
  entryId: ThreadId
  permissions: Permissions
  user: ReviewPanelUser | undefined
  timestamp: ReviewPanelChangeEntry['metadata']['ts']
  contentLimit?: number
  entryIds: ReviewPanelChangeEntry['entry_ids']
}
