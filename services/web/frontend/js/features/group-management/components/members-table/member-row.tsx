import moment from 'moment'
import { type Dispatch, type SetStateAction } from 'react'
import { useTranslation } from 'react-i18next'
import { User } from '../../../../../../types/group-management/user'
import Badge from '../../../../shared/components/badge'
import Tooltip from '../../../../shared/components/tooltip'
import type { GroupUserAlert } from '../../utils/types'
import ManagedUserStatus from './managed-user-status'
import SSOStatus from './sso-status'
import DropdownButton from './dropdown-button'
import SelectUserCheckbox from './select-user-checkbox'
import getMeta from '@/utils/meta'

type ManagedUserRowProps = {
  user: User
  openOffboardingModalForUser: (user: User) => void
  openUnlinkUserModal: (user: User) => void
  groupId: string
  setGroupUserAlert: Dispatch<SetStateAction<GroupUserAlert>>
}

export default function MemberRow({
  user,
  openOffboardingModalForUser,
  openUnlinkUserModal,
  setGroupUserAlert,
  groupId,
}: ManagedUserRowProps) {
  const { t } = useTranslation()
  const managedUsersActive = getMeta('ol-managedUsersActive')
  const groupSSOActive = getMeta('ol-groupSSOActive')

  return (
    <tr
      key={`user-${user.email}`}
      className={`managed-user-row ${user.invite ? 'text-muted' : ''}`}
    >
      <SelectUserCheckbox user={user} />
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
                <Badge
                  bsStyle={null}
                  className="badge-tag-bs3"
                  aria-label={t('pending_invite')}
                  data-testid="badge-pending-invite"
                >
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
      {groupSSOActive && (
        <td className="cell-security">
          <div className="managed-user-security">
            <SSOStatus user={user} />
          </div>
        </td>
      )}
      {managedUsersActive && (
        <td className="cell-managed">
          <div className="managed-user-security">
            <ManagedUserStatus user={user} />
          </div>
        </td>
      )}
      <td className="cell-dropdown">
        <DropdownButton
          user={user}
          openOffboardingModalForUser={openOffboardingModalForUser}
          openUnlinkUserModal={openUnlinkUserModal}
          setGroupUserAlert={setGroupUserAlert}
          groupId={groupId}
        />
      </td>
    </tr>
  )
}
