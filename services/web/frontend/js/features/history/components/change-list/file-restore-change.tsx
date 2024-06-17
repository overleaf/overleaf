import { formatTime } from '@/features/utils/format-date'
import { useTranslation } from 'react-i18next'
import { LoadedUpdate } from '../../services/types/update'

function FileRestoreChange({ origin }: Pick<LoadedUpdate['meta'], 'origin'>) {
  const { t } = useTranslation()

  if (!origin || origin.kind !== 'file-restore') {
    return null
  }

  return (
    <div className="history-version-restore-file">
      {t('file_action_restored', {
        fileName: origin.path,
        date: formatTime(origin.timestamp, 'Do MMMM, h:mm a'),
      })}
    </div>
  )
}

export default FileRestoreChange
