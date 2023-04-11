import { Nullable } from '../../../../../../types/utils'
import {
  Label,
  LoadedUpdate,
  PseudoCurrentStateLabel,
  UpdateSelection,
} from '../../services/types/update'
import { Selection } from '../../../../../../types/history/selection'
import { FileSelection } from '../../services/types/file'
import { ViewMode } from '../../services/types/view-mode'

export type HistoryContextValue = {
  updates: LoadedUpdate[]
  viewMode: ViewMode
  nextBeforeTimestamp: number | undefined
  atEnd: boolean
  userHasFullFeature: boolean | undefined
  freeHistoryLimitHit: boolean
  selection: Selection
  isLoading: boolean
  error: Nullable<unknown>
  labels: Nullable<Array<Label | PseudoCurrentStateLabel>>
  loadingFileTree: boolean
  projectId: string
  fileSelection: FileSelection | null
  setFileSelection: (fileSelection: FileSelection) => void
  updateSelection: UpdateSelection | null
  setUpdateSelection: (updateSelection: UpdateSelection) => void
}
