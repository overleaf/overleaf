import { Trans } from 'react-i18next'
import { formatTime } from '../../../../utils/format-date'
import type { HistoryContextValue } from '../../../context/types/history-context-value'

type ToolbarDatetimeProps = {
  selection: HistoryContextValue['selection']
}

export default function ToolbarDatetime({ selection }: ToolbarDatetimeProps) {
  return (
    <div className="history-react-toolbar-datetime">
      {selection.comparing ? (
        <Trans
          i18nKey="comparing_from_x_to_y"
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
  )
}
