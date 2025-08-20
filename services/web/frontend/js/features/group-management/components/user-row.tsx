import moment from 'moment'
import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { User } from '../../../../../types/group-management/user'
import OLFormCheckbox from '@/shared/components/ol/ol-form-checkbox'
import MaterialIcon from '@/shared/components/material-icon'

type GroupMemberRowProps = {
  user: User
  selectUser: (user: User) => void
  unselectUser: (user: User) => void
  selected: boolean
  hasWriteAccess: boolean
}

export default function UserRow({
  user,
  selectUser,
  unselectUser,
  selected,
  hasWriteAccess,
}: GroupMemberRowProps) {
  const { t } = useTranslation()

  const handleSelectUser = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>, user: User) => {
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
        {hasWriteAccess && (
          <OLFormCheckbox
            autoComplete="off"
            checked={selected}
            onChange={e => handleSelectUser(e, user)}
            aria-label={t('select_user')}
            data-testid="select-single-checkbox"
          />
        )}
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
          <MaterialIcon
            type="clear"
            accessibilityLabel={t('invite_not_accepted')}
          />
        ) : (
          <MaterialIcon
            type="check"
            className="text-success"
            accessibilityLabel={t('accepted_invite')}
          />
        )}
      </td>
    </tr>
  )
}
