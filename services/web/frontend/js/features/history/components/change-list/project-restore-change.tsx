import { formatTime } from '@/features/utils/format-date'
import { useTranslation } from 'react-i18next'
import { LoadedUpdate } from '../../services/types/update'

function ProjectRestoreChange({
  origin,
}: Pick<LoadedUpdate['meta'], 'origin'>) {
  const { t } = useTranslation()

  if (!origin || origin.kind !== 'project-restore') {
    return null
  }

  return (
    <div className="history-version-restore-project">
      {t('file_action_restored_project', {
        date: formatTime(origin.timestamp, 'Do MMMM, h:mm a'),
      })}
    </div>
  )
}

export default ProjectRestoreChange
