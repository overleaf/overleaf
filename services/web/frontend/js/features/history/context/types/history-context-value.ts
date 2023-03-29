import { Nullable } from '../../../../../../types/utils'
import { Update, UpdateSelection } from '../../services/types/update'
import { Selection } from '../../../../../../types/history/selection'
import { FileSelection } from '../../services/types/file'

export type HistoryContextValue = {
  updates: Update[]
  viewMode: string
  nextBeforeTimestamp: Nullable<number>
  atEnd: boolean
  userHasFullFeature: boolean | undefined
  freeHistoryLimitHit: boolean
  selection: Selection
  isError: boolean
  isLoading: boolean
  error: Nullable<unknown>
  labels: Nullable<unknown>
  loadingFileTree: boolean
  projectId: string
  fileSelection: FileSelection | null
  setFileSelection: (fileSelection: FileSelection) => void
  updateSelection: UpdateSelection | null
  setUpdateSelection: (updateSelection: UpdateSelection) => void
}
