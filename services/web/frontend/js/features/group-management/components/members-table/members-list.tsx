import { useState } from 'react'
import { Col, Row } from 'react-bootstrap'
import { useTranslation } from 'react-i18next'
import { User } from '../../../../../../types/group-management/user'
import Tooltip from '@/shared/components/tooltip'
import { useGroupMembersContext } from '../../context/group-members-context'
import type { GroupUserAlert } from '../../utils/types'
import MemberRow from './member-row'
import OffboardManagedUserModal from './offboard-managed-user-modal'
import ListAlert from './list-alert'
import SelectAllCheckbox from './select-all-checkbox'
import classNames from 'classnames'
import getMeta from '@/utils/meta'
import UnlinkUserModal from './unlink-user-modal'

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
      <ul
        className={classNames(
          'list-unstyled',
          'structured-list',
          'managed-users-list',
          {
            'managed-users-active': managedUsersActive,
            'group-sso-active': groupSSOActive,
          }
        )}
      >
        <li className="container-fluid">
          <Row id="managed-users-list-headers">
            <Col xs={12}>
              <table className="managed-users-table">
                <thead>
                  <tr>
                    <SelectAllCheckbox />
                    <td className="cell-email">
                      <span className="header">{t('email')}</span>
                    </td>
                    <td className="cell-name">
                      <span className="header">{t('name')}</span>
                    </td>
                    <td className="cell-last-active">
                      <Tooltip
                        id="last-active-tooltip"
                        description={t('last_active_description')}
                        overlayProps={{
                          placement: 'left',
                        }}
                      >
                        <span className="header">
                          {t('last_active')}
                          <sup>(?)</sup>
                        </span>
                      </Tooltip>
                    </td>
                    {groupSSOActive && (
                      <td className="cell-security">
                        <span className="header">{t('security')}</span>
                      </td>
                    )}
                    {managedUsersActive && (
                      <td className="cell-managed">
                        <span className="header">{t('managed')}</span>
                      </td>
                    )}
                    <td />
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
                  {users.map((user: any) => (
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
              </table>
            </Col>
          </Row>
        </li>
      </ul>
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
