import { Nullable } from '../../../../../../types/utils'
import { LoadedUpdate } from '../../services/types/update'
import { LoadedLabel } from '../../services/types/label'
import { Selection } from '../../services/types/selection'

export type HistoryContextValue = {
  updatesInfo: {
    updates: LoadedUpdate[]
    atEnd: boolean
    nextBeforeTimestamp: number | undefined
    freeHistoryLimitHit: boolean
  }
  setUpdatesInfo: React.Dispatch<
    React.SetStateAction<HistoryContextValue['updatesInfo']>
  >
  userHasFullFeature: boolean | undefined
  loadingState: 'loadingInitial' | 'loadingUpdates' | 'ready'
  error: Nullable<unknown>
  labels: Nullable<LoadedLabel[]>
  setLabels: React.Dispatch<React.SetStateAction<HistoryContextValue['labels']>>
  projectId: string
  selection: Selection
  setSelection: (selection: Selection) => void
  fetchNextBatchOfUpdates: () => void
}
