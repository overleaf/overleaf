import type { Nullable } from '../../../../../../../types/utils'
import type { Diff } from '../../../services/types/doc'
import type { HistoryContextValue } from '../../../context/types/history-context-value'
import ToolbarDatetime from './toolbar-datetime'
import ToolbarFileInfo from './toolbar-file-info'
import ToolbarRestoreFileButton from './toolbar-restore-file-button'
import { isFileRemoved } from '../../../utils/file-diff'
import ToolbarRestoreFileToVersionButton from './toolbar-restore-file-to-version-button'
import { useFeatureFlag } from '@/shared/context/split-test-context'
import SplitTestBadge from '@/shared/components/split-test-badge'

type ToolbarProps = {
  diff: Nullable<Diff>
  selection: HistoryContextValue['selection']
}

export default function Toolbar({ diff, selection }: ToolbarProps) {
  const hasRestoreFileToVersion = useFeatureFlag('revert-file')

  const showRestoreFileToVersionButton =
    hasRestoreFileToVersion && selection.selectedFile

  const showRestoreFileButton =
    selection.selectedFile &&
    isFileRemoved(selection.selectedFile) &&
    !showRestoreFileToVersionButton

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
        <>
          <ToolbarRestoreFileToVersionButton selection={selection} />
          <SplitTestBadge
            splitTestName="revert-file"
            displayOnVariants={['enabled']}
          />
        </>
      ) : null}
    </div>
  )
}
