import { Nullable } from '../../../../../../types/utils'
import { Update, UpdateSelection } from '../../services/types/update'
import { Selection } from '../../../../../../types/history/selection'
import { FileSelection } from '../../services/types/file'

export type HistoryContextValue = {
  updates: Update[]
  viewMode: string
  nextBeforeTimestamp: Nullable<number>
  loading: boolean
  atEnd: boolean
  userHasFullFeature: boolean | undefined
  freeHistoryLimitHit: boolean
  selection: Selection
  error: Nullable<unknown>
  showOnlyLabels: boolean
  labels: Nullable<unknown>
  loadingFileTree: boolean
  projectId: string
  fileSelection: FileSelection | null
  setFileSelection: (fileSelection: FileSelection) => void
  updateSelection: UpdateSelection | null
  setUpdateSelection: (updateSelection: UpdateSelection) => void
}
