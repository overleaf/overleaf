import { Trans, useTranslation } from 'react-i18next'
import { formatTime } from '../../../utils/format-date'
import type { Nullable } from '../../../../../../types/utils'
import type { Diff } from '../../services/types/doc'
import type { HistoryContextValue } from '../../context/types/history-context-value'

type ToolbarProps = {
  diff: Nullable<Diff>
  selection: HistoryContextValue['selection']
}

function Toolbar({ diff, selection }: ToolbarProps) {
  const { t } = useTranslation()

  if (!selection) return null

  return (
    <div className="history-react-toolbar">
      <div>
        {selection.comparing ? (
          <Trans
            i18nKey="comparing_x_to_y"
            // eslint-disable-next-line react/jsx-key
            components={[<time className="history-react-toolbar-time" />]}
            values={{
              startTime: formatTime(
                selection.updateRange?.fromVTimestamp,
                'Do MMMM · h:mm a'
              ),
              endTime: formatTime(
                selection.updateRange?.toVTimestamp,
                'Do MMMM · h:mm a'
              ),
            }}
          />
        ) : (
          <Trans
            i18nKey="viewing_x"
            // eslint-disable-next-line react/jsx-key
            components={[<time className="history-react-toolbar-time" />]}
            values={{
              endTime: formatTime(
                selection.updateRange?.toVTimestamp,
                'Do MMMM · h:mm a'
              ),
            }}
          />
        )}
      </div>
      {selection.pathname ? (
        <div className="history-react-toolbar-changes">
          {t('x_changes_in', {
            count: diff?.docDiff?.highlights.length ?? 0,
          })}
          &nbsp;
          <strong>{getFileName(selection)}</strong>
        </div>
      ) : null}
    </div>
  )
}

function getFileName(selection: HistoryContextValue['selection']) {
  const filePathParts = selection?.pathname?.split('/')
  let fileName
  if (filePathParts) {
    fileName = filePathParts[filePathParts.length - 1]
  }

  return fileName
}

export default Toolbar
