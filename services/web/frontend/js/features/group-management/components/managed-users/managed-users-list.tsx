import { Col, Row } from 'react-bootstrap'
import { useTranslation } from 'react-i18next'
import { User } from '../../../../../../types/group-management/user'
import Tooltip from '../../../../shared/components/tooltip'
import ManagedUserRow from './managed-user-row'
import OffboardManagedUserModal from './offboard-managed-user-modal'
import { useState } from 'react'

type ManagedUsersListProps = {
  handleSelectAllClick: (e: any) => void
  selectedUsers: User[]
  users: User[]
  selectUser: (user: User) => void
  unselectUser: (user: User) => void
  groupId: string
}

export default function ManagedUsersList({
  handleSelectAllClick,
  selectedUsers,
  users,
  selectUser,
  unselectUser,
  groupId,
}: ManagedUsersListProps) {
  const { t } = useTranslation()
  const [userToOffboard, setUserToOffboard] = useState<User | undefined>(
    undefined
  )

  return (
    <div>
      <ul className="list-unstyled structured-list managed-users-list">
        <li className="container-fluid">
          <Row id="managed-users-list-headers">
            <Col xs={6}>
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
              <span className="header">{t('email')}</span>
            </Col>
            <Col xs={2}>
              <span className="header">{t('name')}</span>
            </Col>
            <Col xs={2}>
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
            </Col>
            <Col xs={2}>
              <span className="header">{t('security')}</span>
            </Col>
          </Row>
        </li>
        {users.length === 0 && (
          <li>
            <Row>
              <Col md={12} className="text-centered">
                <small>{t('no_members')}</small>
              </Col>
            </Row>
          </li>
        )}
        {users.map((user: any) => (
          <ManagedUserRow
            key={user.email}
            user={user}
            selectUser={selectUser}
            unselectUser={unselectUser}
            selected={selectedUsers.includes(user)}
            openOffboardingModalForUser={setUserToOffboard}
          />
        ))}
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
