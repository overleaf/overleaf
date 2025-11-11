import type { Nullable } from '../../../../../../../types/utils'
import type { Diff } from '../../../services/types/doc'
import type { HistoryContextValue } from '../../../context/types/history-context-value'
import ToolbarDatetime from './toolbar-datetime'
import ToolbarFileInfo from './toolbar-file-info'
import ToolbarRestoreFileButton from './toolbar-restore-file-button'
import { isFileRemoved } from '../../../utils/file-diff'
import ToolbarRestoreFileToVersionButton from './toolbar-restore-file-to-version-button'
import { useFeatureFlag } from '@/shared/context/split-test-context'
import { usePermissionsContext } from '@/features/ide-react/context/permissions-context'

type ToolbarProps = {
  diff: Nullable<Diff>
  selection: HistoryContextValue['selection']
  isCurrentVersion: boolean
}

export default function Toolbar({
  diff,
  selection,
  isCurrentVersion,
}: ToolbarProps) {
  const { write } = usePermissionsContext()
  const hasRestoreFileToVersion = useFeatureFlag('revert-file')

  const showRestoreFileToVersionButton =
    hasRestoreFileToVersion &&
    selection.selectedFile &&
    write &&
    !isCurrentVersion

  const showRestoreFileButton =
    selection.selectedFile &&
    isFileRemoved(selection.selectedFile) &&
    !showRestoreFileToVersionButton &&
    write

  return (
    <div className="history-react-toolbar">
      <ToolbarDatetime selection={selection} />
      {selection.selectedFile?.pathname ? (
        <ToolbarFileInfo diff={diff} selection={selection} />
      ) : null}
      {showRestoreFileButton ? (
        <ToolbarRestoreFileButton selection={selection} />
      ) : null}
      {showRestoreFileToVersionButton ? (
        <ToolbarRestoreFileToVersionButton selection={selection} />
      ) : null}
    </div>
  )
}
