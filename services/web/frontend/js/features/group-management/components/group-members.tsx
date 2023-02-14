import { useCallback, useMemo, useState } from 'react'
import { Button, Col, Form, FormControl, Row } from 'react-bootstrap'
import { Trans, useTranslation } from 'react-i18next'
import { User } from '../../../../../types/group-management/user'
import {
  deleteJSON,
  FetchError,
  postJSON,
} from '../../../infrastructure/fetch-json'
import MaterialIcon from '../../../shared/components/material-icon'
import Tooltip from '../../../shared/components/tooltip'
import useWaitForI18n from '../../../shared/hooks/use-wait-for-i18n'
import getMeta from '../../../utils/meta'
import { parseEmails } from '../utils/emails'
import ErrorAlert, { APIError } from './error-alert'
import GroupMemberRow from './group-member-row'
import useUserSelection from '../hooks/use-user-selection'

export default function GroupMembers() {
  const { isReady } = useWaitForI18n()
  const { t } = useTranslation()

  const {
    users,
    setUsers,
    selectedUsers,
    selectAllUsers,
    unselectAllUsers,
    selectUser,
    unselectUser,
  } = useUserSelection(getMeta('ol-users', []))

  const [emailString, setEmailString] = useState<string>('')
  const [inviteUserInflightCount, setInviteUserInflightCount] = useState(0)
  const [inviteError, setInviteError] = useState<APIError>()
  const [removeMemberInflightCount, setRemoveMemberInflightCount] = useState(0)
  const [removeMemberError, setRemoveMemberError] = useState<APIError>()

  const groupId: string = getMeta('ol-groupId')
  const groupName: string = getMeta('ol-groupName')
  const groupSize: number = getMeta('ol-groupSize')

  const paths = useMemo(
    () => ({
      addMember: `/manage/groups/${groupId}/invites`,
      removeMember: `/manage/groups/${groupId}/user`,
      removeInvite: `/manage/groups/${groupId}/invites`,
      exportMembers: `/manage/groups/${groupId}/members/export`,
    }),
    [groupId]
  )

  const addMembers = useCallback(
    e => {
      e.preventDefault()
      setInviteError(undefined)
      const emails = parseEmails(emailString)
      ;(async () => {
        for (const email of emails) {
          setInviteUserInflightCount(count => count + 1)
          try {
            const data = await postJSON<{ user: User }>(paths.addMember, {
              body: {
                email,
              },
            })
            if (data.user) {
              const alreadyListed = users.find(
                user => user.email === data.user.email
              )
              if (!alreadyListed) {
                setUsers(users => [...users, data.user])
              }
            }
            setEmailString('')
          } catch (error: unknown) {
            console.error(error)
            setInviteError((error as FetchError)?.data?.error || {})
          }
          setInviteUserInflightCount(count => count - 1)
        }
      })()
    },
    [emailString, paths.addMember, users, setUsers]
  )

  const removeMembers = useCallback(
    e => {
      e.preventDefault()
      setRemoveMemberError(undefined)
      ;(async () => {
        for (const user of selectedUsers) {
          let url
          if (paths.removeInvite && user.invite && user._id == null) {
            url = `${paths.removeInvite}/${encodeURIComponent(user.email)}`
          } else if (paths.removeMember && user._id) {
            url = `${paths.removeMember}/${user._id}`
          } else {
            return
          }
          setRemoveMemberInflightCount(count => count + 1)
          try {
            await deleteJSON(url, {})
            setUsers(users => users.filter(u => u !== user))
            unselectUser(user)
          } catch (error: unknown) {
            console.error(error)
            setRemoveMemberError((error as FetchError)?.data?.error || {})
          }
          setRemoveMemberInflightCount(count => count - 1)
        }
      })()
    },
    [
      selectedUsers,
      unselectUser,
      setUsers,
      paths.removeInvite,
      paths.removeMember,
    ]
  )

  const handleSelectAllClick = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.checked) {
        selectAllUsers()
      } else {
        unselectAllUsers()
      }
    },
    [selectAllUsers, unselectAllUsers]
  )

  const handleEmailsChange = useCallback(
    e => {
      setEmailString(e.target.value)
    },
    [setEmailString]
  )

  if (!isReady) {
    return null
  }

  return (
    <div className="container">
      <Row>
        <Col md={10} mdOffset={1}>
          <h1>
            <a href="/user/subscription" className="back-btn">
              <MaterialIcon
                type="arrow_back"
                accessibilityLabel={t('back_to_subscription')}
              />
            </a>{' '}
            {groupName || t('group_subscription')}
          </h1>
          <div className="card">
            <div className="page-header">
              <div className="pull-right">
                {selectedUsers.length === 0 && (
                  <small>
                    <Trans
                      i18nKey="you_have_added_x_of_group_size_y"
                      components={[<strong />, <strong />]} // eslint-disable-line react/jsx-key
                      values={{ addedUsersSize: users.length, groupSize }}
                    />
                  </small>
                )}
                {removeMemberInflightCount > 0 ? (
                  <Button bsStyle="danger" disabled>
                    {t('removing')}&hellip;
                  </Button>
                ) : (
                  <>
                    {selectedUsers.length > 0 && (
                      <Button bsStyle="danger" onClick={removeMembers}>
                        {t('remove_from_group')}
                      </Button>
                    )}
                  </>
                )}
              </div>
              <h3>{t('members_management')}</h3>
            </div>
            <div className="row-spaced-small">
              <ErrorAlert error={removeMemberError} />
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
            </div>
            <hr />
            {users.length < groupSize && (
              <div>
                <p className="small">{t('add_more_members')}</p>
                <ErrorAlert error={inviteError} />
                <Form horizontal onSubmit={addMembers} className="form">
                  <Row>
                    <Col xs={6}>
                      <FormControl
                        type="input"
                        placeholder="jane@example.com, joe@example.com"
                        aria-describedby="add-members-description"
                        value={emailString}
                        onChange={handleEmailsChange}
                      />
                    </Col>
                    <Col xs={4}>
                      {inviteUserInflightCount > 0 ? (
                        <Button bsStyle="primary" disabled>
                          {t('adding')}&hellip;
                        </Button>
                      ) : (
                        <Button bsStyle="primary" onClick={addMembers}>
                          {t('add')}
                        </Button>
                      )}
                    </Col>
                    <Col xs={2}>
                      <a href={paths.exportMembers}>{t('export_csv')}</a>
                    </Col>
                  </Row>
                  <Row>
                    <Col xs={8}>
                      <span className="help-block">
                        {t('add_comma_separated_emails_help')}
                      </span>
                    </Col>
                  </Row>
                </Form>
              </div>
            )}
            {users.length >= groupSize && users.length > 0 && (
              <>
                <ErrorAlert error={inviteError} />
                <Row>
                  <Col xs={2} xsOffset={10}>
                    <a href={paths.exportMembers}>{t('export_csv')}</a>
                  </Col>
                </Row>
              </>
            )}
          </div>
        </Col>
      </Row>
    </div>
  )
}
