import moment from 'moment'
import { type Dispatch, type SetStateAction, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { User } from '../../../../../../types/group-management/user'
import Badge from '../../../../shared/components/badge'
import Tooltip from '../../../../shared/components/tooltip'
import type { ManagedUserAlert } from '../../utils/types'
import { useGroupMembersContext } from '../../context/group-members-context'
import ManagedUserStatus from './managed-user-status'
import ManagedUserDropdownButton from './managed-user-dropdown-button'

type ManagedUserRowProps = {
  user: User
  openOffboardingModalForUser: (user: User) => void
  groupId: string
  setManagedUserAlert: Dispatch<SetStateAction<ManagedUserAlert>>
}

export default function ManagedUserRow({
  user,
  openOffboardingModalForUser,
  setManagedUserAlert,
  groupId,
}: ManagedUserRowProps) {
  const { t } = useTranslation()
  const { selectedUsers, selectUser, unselectUser } = useGroupMembersContext()

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

  const selected = selectedUsers.includes(user)

  return (
    <tr
      key={`user-${user.email}`}
      className={`managed-user-row ${user.invite ? 'text-muted' : ''}`}
    >
      <td className="cell-checkbox">
        {user.enrollment?.managedBy ? null : (
          <>
            <label htmlFor={`select-user-${user.email}`} className="sr-only">
              {t('select_user')}
            </label>
            <input
              className="select-item"
              id={`select-user-${user.email}`}
              type="checkbox"
              checked={selected}
              onChange={e => handleSelectUser(e, user)}
            />
          </>
        )}
      </td>
      <td className="cell-email">
        <span>
          {user.email}
          {user.invite ? (
            <span>
              &nbsp;
              <Tooltip
                id={`pending-invite-symbol-${user._id}`}
                description={t('pending_invite')}
              >
                <Badge aria-label={t('pending_invite')}>
                  {t('pending_invite')}
                </Badge>
              </Tooltip>
            </span>
          ) : (
            ''
          )}
          {user.isEntityAdmin && (
            <span>
              &nbsp;
              <Tooltip
                id={`group-admin-symbol-${user._id}`}
                description={t('group_admin')}
              >
                <i
                  className="fa fa-user-circle-o"
                  aria-hidden="true"
                  aria-label={t('group_admin')}
                />
              </Tooltip>
            </span>
          )}
        </span>
      </td>
      <td className="cell-name">
        {user.first_name} {user.last_name}
      </td>
      <td className="cell-last-active">
        {user.last_active_at
          ? moment(user.last_active_at).format('Do MMM YYYY')
          : 'N/A'}
      </td>
      <td className="cell-security">
        <div className="managed-user-security">
          <ManagedUserStatus user={user} />
        </div>
      </td>
      <td className="cell-dropdown">
        <ManagedUserDropdownButton
          user={user}
          openOffboardingModalForUser={openOffboardingModalForUser}
          setManagedUserAlert={setManagedUserAlert}
          groupId={groupId}
        />
      </td>
    </tr>
  )
}
