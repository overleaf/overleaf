import moment from 'moment'
import { useCallback } from 'react'
import { Col, Row } from 'react-bootstrap'
import { useTranslation } from 'react-i18next'
import { User } from '../../../../../../types/group-management/user'
import Badge from '../../../../shared/components/badge'
import ManagedUserDropdownButton from './managed-user-dropdown-button'
import Tooltip from '../../../../shared/components/tooltip'
import ManagedUserStatus from './managed-user-status'

type ManagedUserRowProps = {
  user: User
  selectUser: (user: User) => void
  unselectUser: (user: User) => void
  selected: boolean
}

export default function ManagedUserRow({
  user,
  selectUser,
  unselectUser,
  selected,
}: ManagedUserRowProps) {
  const { t } = useTranslation()

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

  return (
    <li
      key={`user-${user.email}`}
      className={`managed-user-row ${user.invite ? 'text-muted' : ''}`}
    >
      <Row>
        <Col xs={6}>
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
        </Col>
        <Col xs={2}>
          {user.first_name} {user.last_name}
        </Col>
        <Col xs={2}>
          {user.last_active_at
            ? moment(user.last_active_at).format('Do MMM YYYY')
            : 'N/A'}
        </Col>
        <Col xs={2}>
          <span className="pull-right">
            <ManagedUserStatus user={user} />
            <span className="managed-user-actions">
              <ManagedUserDropdownButton user={user} />
            </span>
          </span>
        </Col>
      </Row>
    </li>
  )
}
