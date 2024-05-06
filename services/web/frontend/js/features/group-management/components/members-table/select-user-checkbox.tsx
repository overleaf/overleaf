import { useTranslation } from 'react-i18next'
import type { User } from '../../../../../../types/group-management/user'
import { useGroupMembersContext } from '../../context/group-members-context'
import { useCallback } from 'react'

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
    (event, user) => {
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
      {/* the next check will hide the `checkbox` but still show the `td` */}
      {user.enrollment?.managedBy ? null : (
        <>
          <label htmlFor={`select-user-${user.email}`} className="sr-only">
            {t('select_user')}
          </label>
          <input
            className="select-item"
            id={`select-user-${user.email}`}
            type="checkbox"
            autoComplete="off"
            checked={selected}
            onChange={e => handleSelectUser(e, user)}
          />
        </>
      )}
    </td>
  )
}
