import { Nullable } from '../../../../../../types/utils'
import { LoadedUpdate } from '../../services/types/update'
import { LoadedLabel } from '../../services/types/label'
import { Selection } from '../../services/types/selection'

type LoadingState =
  | 'loadingInitial'
  | 'loadingUpdates'
  | 'loadingFileDiffs'
  | 'restoringFile'
  | 'ready'

export type HistoryContextValue = {
  updatesInfo: {
    updates: LoadedUpdate[]
    visibleUpdateCount: Nullable<number>
    atEnd: boolean
    nextBeforeTimestamp: number | undefined
    freeHistoryLimitHit: boolean
  }
  setUpdatesInfo: React.Dispatch<
    React.SetStateAction<HistoryContextValue['updatesInfo']>
  >
  userHasFullFeature: boolean
  currentUserIsOwner: boolean
  loadingState: LoadingState
  setLoadingState: React.Dispatch<
    React.SetStateAction<HistoryContextValue['loadingState']>
  >
  error: Nullable<unknown>
  setError: React.Dispatch<React.SetStateAction<HistoryContextValue['error']>>
  labels: Nullable<LoadedLabel[]>
  setLabels: React.Dispatch<React.SetStateAction<HistoryContextValue['labels']>>
  labelsOnly: boolean
  setLabelsOnly: React.Dispatch<React.SetStateAction<boolean>>
  projectId: string
  selection: Selection
  setSelection: React.Dispatch<
    React.SetStateAction<HistoryContextValue['selection']>
  >
  fetchNextBatchOfUpdates: () => void
  resetSelection: () => void
}
