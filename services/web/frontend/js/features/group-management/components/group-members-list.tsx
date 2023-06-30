import { Col, Row } from 'react-bootstrap'
import { useTranslation } from 'react-i18next'
import { User } from '../../../../../types/group-management/user'
import Tooltip from '../../../shared/components/tooltip'
import GroupMemberRow from './group-member-row'

type GroupMembersListProps = {
  handleSelectAllClick: (e: any) => void
  selectedUsers: User[]
  users: User[]
  selectUser: (user: User) => void
  unselectUser: (user: User) => void
}

export default function GroupMembersList({
  handleSelectAllClick,
  selectedUsers,
  users,
  selectUser,
  unselectUser,
}: GroupMembersListProps) {
  const { t } = useTranslation()
  return (
    <ul className="list-unstyled structured-list">
      <li className="container-fluid">
        <Row>
          <Col xs={4}>
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
          <Col xs={4}>
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
            <span className="header">{t('accepted_invite')}</span>
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
        <GroupMemberRow
          key={user.email}
          user={user}
          selectUser={selectUser}
          unselectUser={unselectUser}
          selected={selectedUsers.includes(user)}
        />
      ))}
    </ul>
  )
}
