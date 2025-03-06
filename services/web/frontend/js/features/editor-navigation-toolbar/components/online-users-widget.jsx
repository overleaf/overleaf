import React from 'react'
import PropTypes from 'prop-types'
import { useTranslation } from 'react-i18next'
import {
  Dropdown,
  DropdownHeader,
  DropdownItem,
  DropdownMenu,
  DropdownToggle,
} from '@/features/ui/components/bootstrap-5/dropdown-menu'
import { getBackgroundColorForUserId } from '@/shared/utils/colors'
import OLTooltip from '@/features/ui/components/ol/ol-tooltip'
import MaterialIcon from '@/shared/components/material-icon'

function OnlineUsersWidget({ onlineUsers, goToUser }) {
  const { t } = useTranslation()

  const shouldDisplayDropdown = onlineUsers.length >= 4

  if (shouldDisplayDropdown) {
    return (
      <Dropdown id="online-users" className="online-users" align="end">
        <DropdownToggle
          as={DropDownToggleButton}
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

OnlineUsersWidget.propTypes = {
  onlineUsers: PropTypes.arrayOf(
    PropTypes.shape({
      user_id: PropTypes.string.isRequired,
      name: PropTypes.string.isRequired,
    })
  ).isRequired,
  goToUser: PropTypes.func.isRequired,
}

function UserIcon({ user, showName, onClick }) {
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

UserIcon.propTypes = {
  user: PropTypes.shape({
    user_id: PropTypes.string.isRequired,
    name: PropTypes.string.isRequired,
  }),
  showName: PropTypes.bool,
  onClick: PropTypes.func,
}

const DropDownToggleButton = React.forwardRef((props, ref) => {
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

DropDownToggleButton.propTypes = {
  onlineUserCount: PropTypes.number.isRequired,
  onClick: PropTypes.func,
}

export default OnlineUsersWidget
