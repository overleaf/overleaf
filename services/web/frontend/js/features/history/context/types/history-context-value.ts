import { Nullable } from '../../../../../../types/utils'
import { LoadedUpdate, UpdateSelection } from '../../services/types/update'
import { LoadedLabel } from '../../services/types/label'
import { FileSelection } from '../../services/types/file'

export type HistoryContextValue = {
  updates: LoadedUpdate[]
  setUpdates: React.Dispatch<
    React.SetStateAction<HistoryContextValue['updates']>
  >
  nextBeforeTimestamp: number | undefined
  atEnd: boolean
  userHasFullFeature: boolean | undefined
  freeHistoryLimitHit: boolean
  isLoading: boolean
  error: Nullable<unknown>
  labels: Nullable<LoadedLabel[]>
  setLabels: React.Dispatch<React.SetStateAction<HistoryContextValue['labels']>>
  loadingFileTree: boolean
  projectId: string
  fileSelection: FileSelection | null
  setFileSelection: (fileSelection: FileSelection) => void
  updateSelection: UpdateSelection | null
  setUpdateSelection: (updateSelection: UpdateSelection) => void
}
