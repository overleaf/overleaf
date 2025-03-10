import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { User } from '../../../../../../types/group-management/user'
import { useGroupMembersContext } from '../../context/group-members-context'
import type { GroupUserAlert } from '../../utils/types'
import MemberRow from './member-row'
import OffboardManagedUserModal from './offboard-managed-user-modal'
import ListAlert from './list-alert'
import SelectAllCheckbox from './select-all-checkbox'
import classNames from 'classnames'
import getMeta from '@/utils/meta'
import UnlinkUserModal from './unlink-user-modal'
import OLTable from '@/features/ui/components/ol/ol-table'
import OLTooltip from '@/features/ui/components/ol/ol-tooltip'

type ManagedUsersListProps = {
  groupId: string
}

export default function MembersList({ groupId }: ManagedUsersListProps) {
  const { t } = useTranslation()
  const [userToOffboard, setUserToOffboard] = useState<User | undefined>(
    undefined
  )
  const [groupUserAlert, setGroupUserAlert] =
    useState<GroupUserAlert>(undefined)
  const [userToUnlink, setUserToUnlink] = useState<User | undefined>(undefined)
  const { users } = useGroupMembersContext()
  const managedUsersActive = getMeta('ol-managedUsersActive')
  const groupSSOActive = getMeta('ol-groupSSOActive')

  return (
    <div>
      {groupUserAlert && (
        <ListAlert
          variant={groupUserAlert.variant}
          userEmail={groupUserAlert.email}
          onDismiss={() => setGroupUserAlert(undefined)}
        />
      )}
      <OLTable
        className={classNames(
          'managed-entities-table',
          'structured-list',
          'managed-entities-list',
          {
            'managed-users-active': managedUsersActive,
            'group-sso-active': groupSSOActive,
          }
        )}
        container={false}
        hover
        data-testid="managed-entities-table"
      >
        <thead>
          <tr>
            <SelectAllCheckbox />
            <th className="cell-email">{t('email')}</th>
            <th className="cell-name">{t('name')}</th>
            <th className="cell-last-active">
              <OLTooltip
                id="last-active-tooltip"
                description={t('last_active_description')}
                overlayProps={{
                  placement: 'left',
                }}
              >
                <span>
                  {t('last_active')}
                  <sup>(?)</sup>
                </span>
              </OLTooltip>
            </th>
            {groupSSOActive && (
              <th className="cell-security">{t('security')}</th>
            )}
            {managedUsersActive && (
              <th className="cell-managed">{t('managed')}</th>
            )}
            <th />
          </tr>
        </thead>
        <tbody>
          {users.length === 0 && (
            <tr>
              <td className="text-center" colSpan={5}>
                <small>{t('no_members')}</small>
              </td>
            </tr>
          )}
          {users.map(user => (
            <MemberRow
              key={user.email}
              user={user}
              openOffboardingModalForUser={setUserToOffboard}
              openUnlinkUserModal={setUserToUnlink}
              setGroupUserAlert={setGroupUserAlert}
              groupId={groupId}
            />
          ))}
        </tbody>
      </OLTable>
      {userToOffboard && (
        <OffboardManagedUserModal
          user={userToOffboard}
          groupId={groupId}
          allMembers={users}
          onClose={() => setUserToOffboard(undefined)}
        />
      )}
      {userToUnlink && (
        <UnlinkUserModal
          user={userToUnlink}
          onClose={() => setUserToUnlink(undefined)}
          setGroupUserAlert={setGroupUserAlert}
        />
      )}
    </div>
  )
}
