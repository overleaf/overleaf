import React, { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useGroupMembersContext } from '../../context/group-members-context'
import OLFormCheckbox from '@/features/ui/components/ol/ol-form-checkbox'
import BootstrapVersionSwitcher from '@/features/ui/components/bootstrap-5/bootstrap-version-switcher'

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
    <th className="cell-checkbox">
      <BootstrapVersionSwitcher
        bs3={
          <input
            className="select-all"
            type="checkbox"
            autoComplete="off"
            onChange={handleSelectAllNonManagedClick}
            checked={selectedUsers.length === nonManagedUsers.length}
            aria-label={t('select_all')}
            data-testid="select-all-checkbox"
          />
        }
        bs5={
          <OLFormCheckbox
            autoComplete="off"
            onChange={handleSelectAllNonManagedClick}
            checked={selectedUsers.length === nonManagedUsers.length}
            aria-label={t('select_all')}
            data-testid="select-all-checkbox"
          />
        }
      />
    </th>
  )
}
