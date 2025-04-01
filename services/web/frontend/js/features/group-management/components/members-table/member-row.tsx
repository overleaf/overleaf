import moment from 'moment'
import { type Dispatch, type SetStateAction } from 'react'
import { useTranslation } from 'react-i18next'
import { User } from '../../../../../../types/group-management/user'
import type { GroupUserAlert } from '../../utils/types'
import ManagedUserStatus from './managed-user-status'
import SSOStatus from './sso-status'
import DropdownButton from './dropdown-button'
import SelectUserCheckbox from './select-user-checkbox'
import getMeta from '@/utils/meta'
import OLTooltip from '@/features/ui/components/ol/ol-tooltip'
import OLTag from '@/features/ui/components/ol/ol-tag'
import MaterialIcon from '@/shared/components/material-icon'
import classnames from 'classnames'

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
    <tr className="managed-entity-row">
      <SelectUserCheckbox user={user} />
      <td
        className={classnames('cell-email', {
          'text-muted': user.invite,
        })}
      >
        <span>
          {user.email}
          {user.invite && (
            <>
              &nbsp;
              <OLTooltip
                id={`pending-invite-symbol-${user.email}`}
                description={t('pending_invite')}
              >
                <OLTag data-testid="badge-pending-invite">
                  {t('pending_invite')}
                </OLTag>
              </OLTooltip>
            </>
          )}
          {user.isEntityAdmin && (
            <>
              &nbsp;
              <OLTooltip
                id={`group-admin-symbol-${user.email}`}
                description={t('group_admin')}
              >
                <span data-testid="group-admin-symbol">
                  <MaterialIcon
                    type="account_circle"
                    accessibilityLabel={t('group_admin')}
                    className="align-middle"
                  />
                </span>
              </OLTooltip>
            </>
          )}
        </span>
      </td>
      <td
        className={classnames('cell-name', {
          'text-muted': user.invite,
        })}
      >
        {user.first_name} {user.last_name}
      </td>
      <td
        className={classnames('cell-last-active', {
          'text-muted': user.invite,
        })}
      >
        {user.last_active_at
          ? moment(user.last_active_at).format('Do MMM YYYY')
          : 'N/A'}
      </td>
      {groupSSOActive && (
        <td
          className={classnames('cell-security', {
            'text-muted': user.invite,
          })}
        >
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
