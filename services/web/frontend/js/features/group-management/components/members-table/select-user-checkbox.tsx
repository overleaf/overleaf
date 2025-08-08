import { useTranslation } from 'react-i18next'
import type { User } from '../../../../../../types/group-management/user'
import { useGroupMembersContext } from '../../context/group-members-context'
import { useCallback } from 'react'
import OLFormCheckbox from '@/shared/components/ol/ol-form-checkbox'

type ManagedUsersSelectUserCheckboxProps = {
  user: User
}

export default function SelectUserCheckbox({
  user,
}: ManagedUsersSelectUserCheckboxProps) {
  const { t } = useTranslation()
  const { users, selectedUsers, selectUser, unselectUser } =
    useGroupMembersContext()

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

  // Pending: user.enrollment will be `undefined`
  // Non managed: user.enrollment will be an empty object
  const nonManagedUsers = users.filter(user => !user.enrollment?.managedBy)

  // Hide the entire `td` (entire column) if no more users available to be click
  // because all users are currently managed
  if (nonManagedUsers.length === 0) {
    return null
  }

  const selected = selectedUsers.includes(user)

  return (
    <td className="cell-checkbox">
      {/* the next check will hide the `checkbox` but still show the `th` */}
      {user.enrollment?.managedBy ? null : (
        <OLFormCheckbox
          autoComplete="off"
          checked={selected}
          onChange={e => handleSelectUser(e, user)}
          aria-label={t('select_user')}
          data-testid="select-single-checkbox"
        />
      )}
    </td>
  )
}
