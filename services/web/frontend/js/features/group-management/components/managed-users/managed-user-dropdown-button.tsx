import { Dropdown, MenuItem } from 'react-bootstrap'
import { User } from '../../../../../../types/group-management/user'
import ControlledDropdown from '../../../../shared/components/controlled-dropdown'
import { useTranslation } from 'react-i18next'
import MenuItemButton from '../../../project-list/components/dropdown/menu-item-button'
import { useGroupMembersContext } from '../../context/group-members-context'

type ManagedUserDropdownButtonProps = {
  user: User
  openOffboardingModalForUser: (user: User) => void
}

export default function ManagedUserDropdownButton({
  user,
  openOffboardingModalForUser,
}: ManagedUserDropdownButtonProps) {
  const { t } = useTranslation()
  const { removeMember } = useGroupMembersContext()

  const onDeleteUserClick = () => {
    openOffboardingModalForUser(user)
  }

  const onRemoveFromGroup = () => {
    removeMember(user)
  }

  return (
    <span className="managed-user-actions">
      <ControlledDropdown id={`managed-user-dropdown-${user.email}`}>
        <Dropdown.Toggle
          bsStyle={null}
          className="btn btn-link action-btn"
          noCaret
        >
          <i
            className="fa fa-ellipsis-v"
            aria-hidden="true"
            aria-label={t('actions')}
          />
        </Dropdown.Toggle>
        <Dropdown.Menu className="dropdown-menu-right managed-users-dropdown-menu">
          {user.enrollment ? (
            <MenuItemButton
              className="delete-user-action"
              data-testid="delete-user-action"
              onClick={onDeleteUserClick}
            >
              {t('delete_user')}
            </MenuItemButton>
          ) : user.isEntityAdmin ? (
            <MenuItem data-testid="no-actions-available">
              <span className="text-muted">{t('no_actions')}</span>
            </MenuItem>
          ) : (
            <MenuItemButton
              onClick={onRemoveFromGroup}
              className="delete-user-action"
              data-testid="remove-user-action"
            >
              {t('remove_from_group')}
            </MenuItemButton>
          )}
        </Dropdown.Menu>
      </ControlledDropdown>
    </span>
  )
}
