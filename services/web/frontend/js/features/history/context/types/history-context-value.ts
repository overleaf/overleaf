import { Nullable } from '../../../../../../types/utils'
import { LoadedUpdate } from '../../services/types/update'
import { LoadedLabel } from '../../services/types/label'
import { Selection } from '../../services/types/selection'

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
  selection: Selection
  setSelection: (selection: Selection) => void
}
