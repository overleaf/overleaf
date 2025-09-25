import { ChangeEvent, FormEvent, useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { deleteJSON, FetchError, postJSON } from '@/infrastructure/fetch-json'
import getMeta from '../../../utils/meta'
import { parseEmails } from '../utils/emails'
import ErrorAlert, { APIError } from './error-alert'
import UserRow from './user-row'
import useUserSelection from '../hooks/use-user-selection'
import { User } from '../../../../../types/group-management/user'
import { debugConsole } from '@/utils/debugging'
import OLRow from '@/shared/components/ol/ol-row'
import OLCol from '@/shared/components/ol/ol-col'
import BackButton from '@/features/group-management/components/back-button'
import OLCard from '@/shared/components/ol/ol-card'
import OLButton from '@/shared/components/ol/ol-button'
import OLFormControl from '@/shared/components/ol/ol-form-control'
import OLFormText from '@/shared/components/ol/ol-form-text'
import OLTable from '@/shared/components/ol/ol-table'
import OLTooltip from '@/shared/components/ol/ol-tooltip'
import OLFormCheckbox from '@/shared/components/ol/ol-form-checkbox'
import OLFormLabel from '@/shared/components/ol/ol-form-label'

type ManagersPaths = {
  addMember: string
  removeMember: string
}

type UsersTableProps = {
  groupName: string
  paths: ManagersPaths
  translations: {
    title: string
    subtitle: string
    remove: string
  }
}

export function ManagersTable({
  groupName,
  translations,
  paths,
}: UsersTableProps) {
  const { t } = useTranslation()

  const {
    users,
    setUsers,
    selectedUsers,
    selectAllUsers,
    unselectAllUsers,
    selectUser,
    unselectUser,
  } = useUserSelection(getMeta('ol-users') || [])

  const [emailString, setEmailString] = useState<string>('')
  const [inviteUserInflightCount, setInviteUserInflightCount] = useState(0)
  const [inviteError, setInviteError] = useState<APIError>()
  const [removeMemberInflightCount, setRemoveMemberInflightCount] = useState(0)
  const [removeMemberError, setRemoveMemberError] = useState<APIError>()
  const hasWriteAccess = getMeta('ol-hasWriteAccess')

  const addManagers = useCallback(
    (e: FormEvent | React.MouseEvent) => {
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
            debugConsole.error(error)
            setInviteError((error as FetchError)?.data?.error || {})
          }
          setInviteUserInflightCount(count => count - 1)
        }
      })()
    },
    [emailString, paths.addMember, users, setUsers]
  )

  const removeManagers = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      setRemoveMemberError(undefined)
      ;(async () => {
        for (const user of selectedUsers) {
          let url
          if (paths.removeMember && user._id) {
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
            debugConsole.error(error)
            setRemoveMemberError((error as FetchError)?.data?.error || {})
          }
          setRemoveMemberInflightCount(count => count - 1)
        }
      })()
    },
    [selectedUsers, unselectUser, setUsers, paths.removeMember]
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
    (e: ChangeEvent<HTMLInputElement>) => {
      setEmailString(e.target.value)
    },
    [setEmailString]
  )

  return (
    <div className="container">
      <OLRow>
        <OLCol lg={{ span: 10, offset: 1 }}>
          <div className="group-heading" data-testid="group-heading">
            <BackButton
              href="/user/subscription"
              accessibilityLabel={t('back_to_subscription')}
            />
            <h1 className="heading">{groupName || translations.title}</h1>
          </div>
          <OLCard>
            <div
              className="page-header mb-4"
              data-testid="page-header-members-details"
            >
              <div className="float-end">
                {removeMemberInflightCount > 0 ? (
                  <OLButton variant="danger" disabled>
                    {t('removing')}&hellip;
                  </OLButton>
                ) : (
                  <>
                    {selectedUsers.length > 0 && (
                      <OLButton variant="danger" onClick={removeManagers}>
                        {translations.remove}
                      </OLButton>
                    )}
                  </>
                )}
              </div>
              <h2 className="h3 mt-0">{translations.subtitle}</h2>
            </div>
            <div className="row-spaced-small">
              <ErrorAlert error={removeMemberError} />
              <OLTable
                className="managed-entities-table managed-entities-list structured-list"
                container={false}
                hover
                data-testid="managed-entities-table"
              >
                <thead>
                  <tr>
                    <th className="cell-checkbox">
                      {hasWriteAccess && (
                        <OLFormCheckbox
                          autoComplete="off"
                          onChange={handleSelectAllClick}
                          checked={selectedUsers.length === users.length}
                          aria-label={t('select_all')}
                          data-testid="select-all-checkbox"
                        />
                      )}
                    </th>
                    <th>{t('email')}</th>
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
                    <th className="cell-accepted-invite">
                      {t('accepted_invite')}
                    </th>
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
                    <UserRow
                      key={user.email}
                      user={user}
                      selectUser={selectUser}
                      unselectUser={unselectUser}
                      selected={selectedUsers.includes(user)}
                      hasWriteAccess={hasWriteAccess}
                    />
                  ))}
                </tbody>
              </OLTable>
            </div>
            {hasWriteAccess && (
              <>
                <hr />
                <div>
                  <ErrorAlert error={inviteError} />
                  <form onSubmit={addManagers} data-testid="add-members-form">
                    <OLRow>
                      <OLCol lg={8}>
                        <OLFormLabel htmlFor="add-manager-emails">
                          {t('add_more_manager_emails')}
                        </OLFormLabel>
                        <OLFormControl
                          id="add-manager-emails"
                          type="input"
                          value={emailString}
                          onChange={handleEmailsChange}
                          aria-describedby="invite-more-manager-help-text"
                        />
                        <OLFormText id="invite-more-manager-help-text">
                          {t('add_comma_separated_emails_help')}
                        </OLFormText>
                      </OLCol>
                      <OLCol
                        lg={2}
                        className="mt-3 mt-lg-0 d-flex align-items-center d-flex flex-column flex-lg-row"
                      >
                        <OLButton
                          variant="primary"
                          onClick={addManagers}
                          isLoading={inviteUserInflightCount > 0}
                          loadingLabel={t('adding')}
                        >
                          {t('add')}
                        </OLButton>
                      </OLCol>
                    </OLRow>
                  </form>
                </div>
              </>
            )}
          </OLCard>
        </OLCol>
      </OLRow>
    </div>
  )
}
