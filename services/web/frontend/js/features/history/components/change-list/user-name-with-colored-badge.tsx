import { useTranslation } from 'react-i18next'
import { formatUserName } from '../../utils/history-details'
import { User } from '../../services/types/shared'
import { Nullable } from '../../../../../../types/utils'
import { getBackgroundColorForUserId } from '@/shared/utils/colors'

type UserNameWithColoredBadgeProps = {
  currentUserId: string
  user: Nullable<User | { id: string; displayName: string }>
}

function UserNameWithColoredBadge({
  user,
  currentUserId,
}: UserNameWithColoredBadgeProps) {
  const { t } = useTranslation()
  let allowBrowserTranslate = true

  let userName: string
  if (!user) {
    userName = t('anonymous')
  } else if (user.id === currentUserId) {
    userName = t('you')
  } else if ('displayName' in user) {
    userName = user.displayName
    allowBrowserTranslate = false
  } else {
    userName = formatUserName(user)
    allowBrowserTranslate = false
  }

  return (
    <>
      <span
        className="history-version-user-badge-color"
        style={{ backgroundColor: getBackgroundColorForUserId(user?.id) }}
      />
      <span
        className="history-version-user-badge-text"
        translate={allowBrowserTranslate ? 'yes' : 'no'}
      >
        {userName}
      </span>
    </>
  )
}

export default UserNameWithColoredBadge
