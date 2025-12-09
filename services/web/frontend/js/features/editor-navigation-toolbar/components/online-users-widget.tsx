import React from 'react'
import { useTranslation } from 'react-i18next'
import {
  Dropdown,
  DropdownHeader,
  DropdownItem,
  DropdownMenu,
  DropdownToggle,
} from '@/shared/components/dropdown/dropdown-menu'
import { getBackgroundColorForUserId } from '@/shared/utils/colors'
import OLTooltip from '@/shared/components/ol/ol-tooltip'
import MaterialIcon from '@/shared/components/material-icon'
import { OnlineUser } from '@/features/ide-react/context/online-users-context'
import { Doc } from '@ol-types/doc'

function OnlineUsersWidget({
  onlineUsers,
  goToUser,
}: {
  onlineUsers: OnlineUser[]
  goToUser: (user: OnlineUser) => Promise<Doc | undefined>
}) {
  const { t } = useTranslation()

  const shouldDisplayDropdown = onlineUsers.length >= 4

  if (shouldDisplayDropdown) {
    return (
      <Dropdown className="online-users" align="end">
        <DropdownToggle
          id="online-users"
          as={DropDownToggleButton}
          // @ts-ignore: fix type of DropdownToggle with "as" prop so that it can accept
          // custom props for that component
          onlineUserCount={onlineUsers.length}
        />
        <DropdownMenu>
          <DropdownHeader aria-hidden="true">
            {t('connected_users')}
          </DropdownHeader>
          {onlineUsers.map((user, index) => (
            <li role="none" key={`${user.user_id}_${index}`}>
              <DropdownItem
                as="button"
                tabIndex={-1}
                onClick={() => goToUser(user)}
              >
                <UserIcon user={user} showName />
              </DropdownItem>
            </li>
          ))}
        </DropdownMenu>
      </Dropdown>
    )
  } else {
    return (
      <div className="online-users">
        {onlineUsers.map((user, index) => (
          <OLTooltip
            key={`${user.user_id}_${index}`}
            id="online-user"
            description={user.name}
            overlayProps={{ placement: 'bottom', trigger: ['hover', 'focus'] }}
            tooltipProps={{ translate: 'no' }}
          >
            <span>
              {/* OverlayTrigger won't fire unless UserIcon is wrapped in a span */}
              <UserIcon user={user} onClick={goToUser} />
            </span>
          </OLTooltip>
        ))}
      </div>
    )
  }
}

function UserIcon({
  user,
  showName,
  onClick,
}: {
  user: OnlineUser
  showName?: boolean
  onClick?: (user: OnlineUser) => void
}) {
  const backgroundColor = getBackgroundColorForUserId(user.user_id)

  function handleOnClick() {
    onClick?.(user)
  }

  const [character] = [...user.name]

  return (
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
    <span onClick={handleOnClick}>
      <span className="online-user" style={{ backgroundColor }}>
        {character}
      </span>
      {showName && user.name}
    </span>
  )
}

const DropDownToggleButton = React.forwardRef<
  HTMLButtonElement,
  { onlineUserCount: number; onClick: React.MouseEventHandler }
>((props, ref) => {
  const { t } = useTranslation()
  return (
    <OLTooltip
      id="connected-users"
      description={t('connected_users')}
      overlayProps={{ placement: 'left' }}
    >
      <button
        type="button"
        className="online-user online-user-multi"
        onClick={props.onClick} // required by Bootstrap Dropdown to trigger an opening
        ref={ref}
      >
        <strong>{props.onlineUserCount}</strong>&nbsp;
        <MaterialIcon type="groups" />
      </button>
    </OLTooltip>
  )
})

DropDownToggleButton.displayName = 'DropDownToggleButton'

export default OnlineUsersWidget
