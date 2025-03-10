import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { deleteJSON, FetchError, postJSON } from '@/infrastructure/fetch-json'
import getMeta from '../../../utils/meta'
import { parseEmails } from '../utils/emails'
import ErrorAlert, { APIError } from './error-alert'
import UserRow from './user-row'
import useUserSelection from '../hooks/use-user-selection'
import { User } from '../../../../../types/group-management/user'
import { debugConsole } from '@/utils/debugging'
import OLRow from '@/features/ui/components/ol/ol-row'
import OLCol from '@/features/ui/components/ol/ol-col'
import BackButton from '@/features/group-management/components/back-button'
import OLCard from '@/features/ui/components/ol/ol-card'
import OLButton from '@/features/ui/components/ol/ol-button'
import OLFormControl from '@/features/ui/components/ol/ol-form-control'
import OLFormText from '@/features/ui/components/ol/ol-form-text'
import OLTable from '@/features/ui/components/ol/ol-table'
import OLTooltip from '@/features/ui/components/ol/ol-tooltip'
import OLFormCheckbox from '@/features/ui/components/ol/ol-form-checkbox'
import BootstrapVersionSwitcher from '@/features/ui/components/bootstrap-5/bootstrap-version-switcher'

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

  const addManagers = useCallback(
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
    e => {
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
    e => {
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
              <div className="pull-right">
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
                      <BootstrapVersionSwitcher
                        bs3={
                          <input
                            className="select-all"
                            type="checkbox"
                            autoComplete="off"
                            onChange={handleSelectAllClick}
                            checked={selectedUsers.length === users.length}
                            aria-label={t('select_all')}
                            data-testid="select-all-checkbox"
                          />
                        }
                        bs5={
                          <OLFormCheckbox
                            autoComplete="off"
                            onChange={handleSelectAllClick}
                            checked={selectedUsers.length === users.length}
                            aria-label={t('select_all')}
                            data-testid="select-all-checkbox"
                          />
                        }
                      />
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
                    />
                  ))}
                </tbody>
              </OLTable>
            </div>
            <hr />
            <div>
              <p className="small">{t('add_more_managers')}</p>
              <ErrorAlert error={inviteError} />
              <form onSubmit={addManagers} data-testid="add-members-form">
                <OLRow>
                  <OLCol xs={6}>
                    <OLFormControl
                      type="input"
                      placeholder="jane@example.com, joe@example.com"
                      aria-describedby="add-members-description"
                      value={emailString}
                      onChange={handleEmailsChange}
                    />
                  </OLCol>
                  <OLCol xs={4}>
                    <OLButton
                      variant="primary"
                      onClick={addManagers}
                      isLoading={inviteUserInflightCount > 0}
                      bs3Props={{
                        loading:
                          inviteUserInflightCount > 0 ? (
                            <>{t('adding')}&hellip;</>
                          ) : (
                            t('add')
                          ),
                      }}
                    >
                      {t('add')}
                    </OLButton>
                  </OLCol>
                </OLRow>
                <OLRow>
                  <OLCol xs={8}>
                    <OLFormText bs3Props={{ className: 'help-block' }}>
                      {t('add_comma_separated_emails_help')}
                    </OLFormText>
                  </OLCol>
                </OLRow>
              </form>
            </div>
          </OLCard>
        </OLCol>
      </OLRow>
    </div>
  )
}
