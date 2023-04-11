import { useTranslation } from 'react-i18next'
import { LoadedUpdate } from '../../services/types/update'

function Origin({ origin }: Pick<LoadedUpdate['meta'], 'origin'>) {
  const { t } = useTranslation()

  let result: string | null = null
  if (origin?.kind === 'dropbox') result = t('history_entry_origin_dropbox')
  if (origin?.kind === 'upload') result = t('history_entry_origin_upload')
  if (origin?.kind === 'git-bridge') result = t('history_entry_origin_git')
  if (origin?.kind === 'github') result = t('history_entry_origin_github')

  if (result) {
    return <span className="history-version-origin">({result})</span>
  }
  return null
}

export default Origin
