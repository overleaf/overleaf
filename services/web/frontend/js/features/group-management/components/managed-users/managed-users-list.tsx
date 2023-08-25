import { useState } from 'react'
import { Col, Row } from 'react-bootstrap'
import { useTranslation } from 'react-i18next'
import { User } from '../../../../../../types/group-management/user'
import Tooltip from '../../../../shared/components/tooltip'
import { useGroupMembersContext } from '../../context/group-members-context'
import type { ManagedUserAlert } from '../../utils/types'
import ManagedUserRow from './managed-user-row'
import OffboardManagedUserModal from './offboard-managed-user-modal'
import ManagedUsersListAlert from './managed-users-list-alert'

type ManagedUsersListProps = {
  handleSelectAllClick: (e: any) => void
  groupId: string
}

export default function ManagedUsersList({
  handleSelectAllClick,
  groupId,
}: ManagedUsersListProps) {
  const { t } = useTranslation()
  const [userToOffboard, setUserToOffboard] = useState<User | undefined>(
    undefined
  )
  const [managedUserAlert, setManagedUserAlert] =
    useState<ManagedUserAlert>(undefined)
  const { selectedUsers, users } = useGroupMembersContext()

  return (
    <div>
      {managedUserAlert && (
        <ManagedUsersListAlert
          variant={managedUserAlert.variant}
          invitedUserEmail={managedUserAlert.email}
          onDismiss={() => setManagedUserAlert(undefined)}
        />
      )}
      <ul className="list-unstyled structured-list managed-users-list">
        <li className="container-fluid">
          <Row id="managed-users-list-headers">
            <Col xs={12}>
              <table className="managed-users-table">
                <thead>
                  <tr>
                    <td className="cell-checkbox">
                      <label htmlFor="select-all" className="sr-only">
                        {t('select_all')}
                      </label>
                      <input
                        className="select-all"
                        id="select-all"
                        type="checkbox"
                        onChange={handleSelectAllClick}
                        checked={selectedUsers.length === users.length}
                      />
                    </td>
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
                    <td className="cell-security">
                      <span className="header">{t('security')}</span>
                    </td>
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
                    <ManagedUserRow
                      key={user.email}
                      user={user}
                      openOffboardingModalForUser={setUserToOffboard}
                      setManagedUserAlert={setManagedUserAlert}
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
    </div>
  )
}
