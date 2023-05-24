import { Nullable } from '../../../../../../types/utils'
import { LoadedUpdate } from '../../services/types/update'
import { LoadedLabel } from '../../services/types/label'
import { Selection } from '../../services/types/selection'

type UpdatesLoadingState = 'loadingInitial' | 'loadingUpdates' | 'ready'

export type HistoryContextValue = {
  updatesInfo: {
    updates: LoadedUpdate[]
    visibleUpdateCount: Nullable<number>
    atEnd: boolean
    nextBeforeTimestamp: number | undefined
    freeHistoryLimitHit: boolean
    loadingState: UpdatesLoadingState
  }
  setUpdatesInfo: React.Dispatch<
    React.SetStateAction<HistoryContextValue['updatesInfo']>
  >
  userHasFullFeature: boolean
  currentUserIsOwner: boolean
  loadingFileDiffs: boolean
  labels: Nullable<LoadedLabel[]>
  setLabels: React.Dispatch<React.SetStateAction<HistoryContextValue['labels']>>
  labelsOnly: boolean
  setLabelsOnly: React.Dispatch<React.SetStateAction<boolean>>
  projectId: string
  selection: Selection
  setSelection: React.Dispatch<
    React.SetStateAction<HistoryContextValue['selection']>
  >
  fetchNextBatchOfUpdates: () => (() => void) | void
  resetSelection: () => void
}
