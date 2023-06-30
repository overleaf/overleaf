import { Dropdown, MenuItem } from 'react-bootstrap'
import { User } from '../../../../../../types/group-management/user'
import ControlledDropdown from '../../../../shared/components/controlled-dropdown'
import { useTranslation } from 'react-i18next'

type ManagedUserDropdownButtonProps = {
  user: User
}

export default function ManagedUserDropdownButton({
  user,
}: ManagedUserDropdownButtonProps) {
  const { t } = useTranslation()
  return (
    <ControlledDropdown id={`managed-user-dropdown-${user._id}`}>
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
      <Dropdown.Menu className="dropdown-menu-right">
        {user.enrollment ? (
          <MenuItem className="delete-user-action">{t('delete_user')}</MenuItem>
        ) : (
          <>
            <MenuItem className="no-actions-available">
              <span className="text-muted">{t('no_actions')}</span>
            </MenuItem>
          </>
        )}
      </Dropdown.Menu>
    </ControlledDropdown>
  )
}
