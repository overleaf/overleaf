import { useTranslation } from 'react-i18next'
import type { HistoryContextValue } from '../../../context/types/history-context-value'
import type { Diff } from '../../../services/types/doc'
import type { Nullable } from '../../../../../../../types/utils'

type ToolbarFileInfoProps = {
  diff: Nullable<Diff>
  selection: HistoryContextValue['selection']
}

export default function ToolbarFileInfo({
  diff,
  selection,
}: ToolbarFileInfoProps) {
  const { t } = useTranslation()

  return (
    <div className="history-react-toolbar-file-info">
      {t('x_changes_in', {
        count: diff?.docDiff?.highlights?.length ?? 0,
      })}
      &nbsp;
      <strong>{getFileName(selection)}</strong>
    </div>
  )
}

function getFileName(selection: HistoryContextValue['selection']) {
  const filePathParts = selection?.selectedFile?.pathname?.split('/')
  let fileName
  if (filePathParts) {
    fileName = filePathParts[filePathParts.length - 1]
  }

  return fileName
}
