import { useTranslation } from 'react-i18next'
import { LoadedUpdate } from '../../services/types/update'
import UserNameWithColoredBadge from './user-name-with-colored-badge'
import { getBackgroundColorForUserId } from '@/shared/utils/colors'

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
    <ol
      className="history-version-metadata-users"
      data-testid="history-version-metadata-users"
    >
      {users.map((user, index) => (
        <li key={index}>
          <UserNameWithColoredBadge user={user} currentUserId={currentUserId} />
        </li>
      ))}
      {!users.length && (
        <li>
          <span
            className="history-version-user-badge-color"
            style={{ backgroundColor: getBackgroundColorForUserId() }}
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
