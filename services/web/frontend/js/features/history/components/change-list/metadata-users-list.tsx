import { useTranslation } from 'react-i18next'
import { getUserColor, formatUserName } from '../../utils/history-details'
import { LoadedUpdate } from '../../services/types/update'

type MetadataUsersListProps = {
  currentUserId: string
} & Pick<LoadedUpdate['meta'], 'users' | 'origin'>

function MetadataUsersList({
  users,
  origin,
  currentUserId,
}: MetadataUsersListProps) {
  const { t } = useTranslation()

  return (
    <ol className="history-version-metadata-users">
      {users.map((user, index) => {
        let userName: string
        if (!user) {
          userName = t('anonymous')
        } else if (user?.id === currentUserId) {
          userName = t('you')
        } else {
          userName = formatUserName(user)
        }

        return (
          <li key={index}>
            <span
              className="history-version-user-badge-color"
              style={{ backgroundColor: getUserColor(user) }}
            />
            {userName}
          </li>
        )
      })}
      {!users.length && (
        <li>
          <span
            className="history-version-user-badge-color"
            style={{ backgroundColor: getUserColor() }}
          />
          {origin?.kind === 'history-resync' ||
          origin?.kind === 'history-migration'
            ? t('overleaf_history_system')
            : t('anonymous')}
        </li>
      )}
    </ol>
  )
}

export default MetadataUsersList
