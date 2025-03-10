import moment from 'moment'
import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { User } from '../../../../../types/group-management/user'
import OLFormCheckbox from '@/features/ui/components/ol/ol-form-checkbox'
import BootstrapVersionSwitcher from '@/features/ui/components/bootstrap-5/bootstrap-version-switcher'
import Icon from '@/shared/components/icon'
import MaterialIcon from '@/shared/components/material-icon'

type GroupMemberRowProps = {
  user: User
  selectUser: (user: User) => void
  unselectUser: (user: User) => void
  selected: boolean
}

export default function UserRow({
  user,
  selectUser,
  unselectUser,
  selected,
}: GroupMemberRowProps) {
  const { t } = useTranslation()

  const handleSelectUser = useCallback(
    (event, user) => {
      if (event.target.checked) {
        selectUser(user)
      } else {
        unselectUser(user)
      }
    },
    [selectUser, unselectUser]
  )

  return (
    <tr key={`user-${user.email}`} className="managed-entity-row">
      <td className="cell-checkbox">
        <BootstrapVersionSwitcher
          bs3={
            <input
              className="select-item"
              type="checkbox"
              autoComplete="off"
              checked={selected}
              onChange={e => handleSelectUser(e, user)}
              aria-label={t('select_user')}
              data-testid="select-single-checkbox"
            />
          }
          bs5={
            <OLFormCheckbox
              autoComplete="off"
              checked={selected}
              onChange={e => handleSelectUser(e, user)}
              aria-label={t('select_user')}
              data-testid="select-single-checkbox"
            />
          }
        />
      </td>
      <td>{user.email}</td>
      <td className="cell-name">
        {user.first_name} {user.last_name}
      </td>
      <td className="cell-last-active">
        {user.last_active_at
          ? moment(user.last_active_at).format('Do MMM YYYY')
          : 'N/A'}
      </td>
      <td className="cell-accepted-invite">
        {user.invite ? (
          <BootstrapVersionSwitcher
            bs3={
              <Icon
                type="times"
                accessibilityLabel={t('invite_not_accepted')}
              />
            }
            bs5={
              <MaterialIcon
                type="clear"
                accessibilityLabel={t('invite_not_accepted')}
              />
            }
          />
        ) : (
          <BootstrapVersionSwitcher
            bs3={
              <Icon
                type="check"
                className="text-success"
                accessibilityLabel={t('accepted_invite')}
              />
            }
            bs5={
              <MaterialIcon
                type="check"
                className="text-success"
                accessibilityLabel={t('accepted_invite')}
              />
            }
          />
        )}
      </td>
    </tr>
  )
}
