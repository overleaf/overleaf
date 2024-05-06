import moment from 'moment'
import { useCallback } from 'react'
import { Col, Row } from 'react-bootstrap'
import { useTranslation } from 'react-i18next'
import { User } from '../../../../../types/group-management/user'

type GroupMemberRowProps = {
  user: User
  selectUser: (user: User) => void
  unselectUser: (user: User) => void
  selected: boolean
}

export default function UserRow({
  user,
  selectUser,
  unselectUser,
  selected,
}: GroupMemberRowProps) {
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
    <li key={`user-${user.email}`}>
      <Row>
        <Col xs={4}>
          <label htmlFor={`select-user-${user.email}`} className="sr-only">
            {t('select_user')}
          </label>
          <input
            className="select-item"
            id={`select-user-${user.email}`}
            type="checkbox"
            autoComplete="off"
            checked={selected}
            onChange={e => handleSelectUser(e, user)}
          />
          <span>{user.email}</span>
        </Col>
        <Col xs={4}>
          {user.first_name} {user.last_name}
        </Col>
        <Col xs={2}>
          {user.last_active_at
            ? moment(user.last_active_at).format('Do MMM YYYY')
            : 'N/A'}
        </Col>
        <Col xs={2}>
          {user.invite ? (
            <>
              <i
                className="fa fa-times"
                aria-hidden="true"
                aria-label={t('invite_not_accepted')}
              />
              <span className="sr-only">{t('invite_not_accepted')}</span>
            </>
          ) : (
            <>
              <i
                className="fa fa-check text-success"
                aria-hidden="true"
                aria-label={t('accepted_invite')}
              />
              <span className="sr-only">{t('accepted_invite')}</span>
            </>
          )}
        </Col>
      </Row>
    </li>
  )
}
