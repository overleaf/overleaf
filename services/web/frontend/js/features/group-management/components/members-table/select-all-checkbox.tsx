import React, { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useGroupMembersContext } from '../../context/group-members-context'

export default function SelectAllCheckbox() {
  const { t } = useTranslation()

  const { selectedUsers, users, selectAllNonManagedUsers, unselectAllUsers } =
    useGroupMembersContext()

  const handleSelectAllNonManagedClick = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.checked) {
        selectAllNonManagedUsers()
      } else {
        unselectAllUsers()
      }
    },
    [selectAllNonManagedUsers, unselectAllUsers]
  )

  // Pending: user.enrollment will be `undefined`
  // Not managed: user.enrollment will be an empty object
  const nonManagedUsers = users.filter(user => !user.enrollment?.managedBy)

  if (nonManagedUsers.length === 0) {
    return null
  }

  return (
    <td className="cell-checkbox">
      <label htmlFor="select-all" className="sr-only">
        {t('select_all')}
      </label>
      <input
        className="select-all"
        id="select-all"
        type="checkbox"
        autoComplete="off"
        onChange={handleSelectAllNonManagedClick}
        checked={selectedUsers.length === nonManagedUsers.length}
      />
    </td>
  )
}
