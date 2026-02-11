import { OnlineUser } from '@/features/ide-react/context/online-users-context'
import {
  Dropdown,
  DropdownHeader,
  DropdownItem,
  DropdownMenu,
  DropdownToggle,
} from '@/shared/components/dropdown/dropdown-menu'
import OLTooltip from '@/shared/components/ol/ol-tooltip'
import {
  getBackgroundColorForUserId,
  hslStringToLuminance,
} from '@/shared/utils/colors'
import classNames from 'classnames'
import { useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Doc } from '@ol-types/doc'

// Should be kept in sync with $max-user-circles-displayed CSS constant
const MAX_USER_CIRCLES_DISPLAYED = 5

// We don't want a +1 circle since we could just show the user instead
const MAX_USERS_WITH_OVERFLOW_VISIBLE = MAX_USER_CIRCLES_DISPLAYED - 1

export const OnlineUsersWidget = ({
  onlineUsers,
  goToUser,
}: {
  onlineUsers: OnlineUser[]
  goToUser: (user: OnlineUser) => Promise<Doc | undefined>
}) => {
  const hasOverflow = onlineUsers.length > MAX_USER_CIRCLES_DISPLAYED
  const usersBeforeOverflow = useMemo(
    () =>
      hasOverflow
        ? onlineUsers.slice(0, MAX_USERS_WITH_OVERFLOW_VISIBLE)
        : onlineUsers,
    [onlineUsers, hasOverflow]
  )
  const usersInOverflow = useMemo(
    () =>
      hasOverflow ? onlineUsers.slice(MAX_USERS_WITH_OVERFLOW_VISIBLE) : [],
    [onlineUsers, hasOverflow]
  )

  return (
    <div className="online-users-row">
      {usersBeforeOverflow.map((user, index) => (
        <OnlineUserWidget
          key={`${user.user_id}_${index}`}
          user={user}
          goToUser={goToUser}
          id={`online-user-${user.user_id}_${index}`}
        />
      ))}
      {hasOverflow && (
        <OnlineUserOverflow goToUser={goToUser} users={usersInOverflow} />
      )}
    </div>
  )
}

const OnlineUserWidget = ({
  user,
  goToUser,
  id,
}: {
  user: OnlineUser
  goToUser: (user: OnlineUser) => void
  id: string
}) => {
  const onClick = useCallback(() => {
    goToUser(user)
  }, [goToUser, user])
  return (
    <OLTooltip
      id={id}
      description={user.name}
      overlayProps={{
        placement: 'bottom',
        trigger: ['hover', 'focus'],
        delay: 0,
      }}
    >
      <button className="online-users-row-button" onClick={onClick}>
        <OnlineUserCircle user={user} />
      </button>
    </OLTooltip>
  )
}

const OnlineUserCircle = ({ user }: { user: OnlineUser }) => {
  const backgroundColor = getBackgroundColorForUserId(user.user_id)
  const luminance = hslStringToLuminance(backgroundColor)
  const [character] = [...user.name]
  return (
    <span
      className={classNames('online-user-circle', {
        'online-user-circle-light-font': luminance < 0.5,
        'online-user-circle-dark-font': luminance >= 0.5,
      })}
      style={{ backgroundColor }}
    >
      {character}
    </span>
  )
}

const OnlineUserOverflow = ({
  goToUser,
  users,
}: {
  goToUser: (user: OnlineUser) => void
  users: OnlineUser[]
}) => {
  const { t } = useTranslation()
  return (
    <Dropdown align="end">
      <DropdownToggle className="online-users-row-button online-user-overflow-toggle">
        <OLTooltip
          id="connected-users"
          description={t('n_more_collaborators', { count: users.length })}
          overlayProps={{ placement: 'bottom' }}
        >
          <span className="online-user-circle">+{users.length}</span>
        </OLTooltip>
      </DropdownToggle>
      <DropdownMenu className="online-user-overflow-dropdown">
        <DropdownHeader aria-hidden="true">
          {t('connected_users')}
        </DropdownHeader>
        {users.map((user, index) => (
          <li role="none" key={`${user.user_id}_${index}`}>
            <DropdownItem
              as="button"
              tabIndex={-1}
              onClick={() => goToUser(user)}
            >
              <OnlineUserCircle user={user} /> {user.name}
            </DropdownItem>
          </li>
        ))}
      </DropdownMenu>
    </Dropdown>
  )
}
