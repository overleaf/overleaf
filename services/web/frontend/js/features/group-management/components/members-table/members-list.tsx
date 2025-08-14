import { useState, useRef, useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { User } from '../../../../../../types/group-management/user'
import { useGroupMembersContext } from '../../context/group-members-context'
import type { GroupUserAlert } from '../../utils/types'
import MemberRow from './member-row'
import OffboardManagedUserModal from './offboard-managed-user-modal'
import RemoveManagedUserModal from '@/features/group-management/components/members-table/remove-managed-user-modal'
import ListAlert from './list-alert'
import SelectAllCheckbox from './select-all-checkbox'
import classNames from 'classnames'
import getMeta from '@/utils/meta'
import UnlinkUserModal from './unlink-user-modal'
import OLTable from '@/shared/components/ol/ol-table'
import OLTooltip from '@/shared/components/ol/ol-tooltip'
import Pagination from '@/shared/components/pagination'
import OLFormControl from '@/shared/components/ol/ol-form-control'
import OLForm from '@/shared/components/ol/ol-form'
import OLFormGroup from '@/shared/components/ol/ol-form-group'
import OLCol from '@/shared/components/ol/ol-col'
import MaterialIcon from '@/shared/components/material-icon'
import OLRow from '@/shared/components/ol/ol-row'
import { isNonEmptyString, NonEmptyString } from '@ol-types/helpers/string'

const USERS_DISPLAY_LIMIT = 50

type ManagedUsersListProps = {
  groupId: string
  hasWriteAccess: boolean
}

function isUserSearchMatch(user: User, search: NonEmptyString): boolean {
  const lowercaseSearch = search.toLowerCase()

  return Boolean(
    [user.email, user.first_name, user.last_name].find(
      fieldValue =>
        // if the field is null treat it as a match
        fieldValue == null || fieldValue.toLowerCase().includes(lowercaseSearch)
    )
  )
}

export default function MembersList({
  groupId,
  hasWriteAccess,
}: ManagedUsersListProps) {
  const { t } = useTranslation()
  const [userToOffboard, setUserToOffboard] = useState<User | undefined>(
    undefined
  )
  const [userToRemove, setUserToRemove] = useState<User | undefined>(undefined)
  const [groupUserAlert, setGroupUserAlert] =
    useState<GroupUserAlert>(undefined)
  const [userToUnlink, setUserToUnlink] = useState<User | undefined>(undefined)
  const { users } = useGroupMembersContext()
  const managedUsersActive = getMeta('ol-managedUsersActive')
  const groupSSOActive = getMeta('ol-groupSSOActive')
  const tHeadRowRef = useRef<HTMLTableRowElement>(null)
  const [userSearchString, setUserSearchString] = useState('')
  const userSearchRef = useRef<HTMLInputElement>(null)
  const [pagination, setPagination] = useState({ currPage: 1, totalPages: 1 })

  const filteredUsers = useMemo(
    () =>
      isNonEmptyString(userSearchString)
        ? users.filter(user => isUserSearchMatch(user, userSearchString))
        : users,
    [users, userSearchString]
  )

  const usersForCurrentPage = useMemo(
    () =>
      filteredUsers.slice(
        (pagination.currPage - 1) * USERS_DISPLAY_LIMIT,
        pagination.currPage * USERS_DISPLAY_LIMIT
      ),
    [filteredUsers, pagination.currPage]
  )

  const handleUserSearchStringChange = (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    setUserSearchString(e.target.value)
  }

  const handleClearUserSearchString = () => {
    setUserSearchString('')
    if (userSearchRef.current) {
      userSearchRef.current.focus()
    }
  }

  const handlePageClick = (
    _e: React.MouseEvent<HTMLButtonElement>,
    page: number
  ) => {
    setPagination(p => ({ ...p, currPage: page }))
  }

  useEffect(() => {
    setPagination(p => ({
      ...p,
      totalPages: Math.ceil(filteredUsers.length / USERS_DISPLAY_LIMIT),
    }))
  }, [filteredUsers.length])

  return (
    <div>
      {groupUserAlert && (
        <ListAlert
          variant={groupUserAlert.variant}
          userEmail={groupUserAlert.email}
          onDismiss={() => setGroupUserAlert(undefined)}
        />
      )}
      <OLForm role="search" onSubmit={e => e.preventDefault()}>
        <OLFormGroup>
          <OLRow>
            <OLCol lg={7}>
              <OLFormControl
                ref={userSearchRef}
                placeholder={t('search_members')}
                aria-label={t('search_members')}
                prepend={<MaterialIcon type="search" />}
                append={
                  userSearchString.length > 0 && (
                    <button
                      type="button"
                      className="form-control-search-clear-btn"
                      aria-label={t('clear_search')}
                      onClick={handleClearUserSearchString}
                    >
                      <MaterialIcon type="clear" />
                    </button>
                  )
                }
                value={userSearchString}
                onChange={handleUserSearchStringChange}
                data-testid="search-members-input"
              />
            </OLCol>
          </OLRow>
        </OLFormGroup>
      </OLForm>
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
          <tr ref={tHeadRowRef}>
            {hasWriteAccess && <SelectAllCheckbox />}
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
            {hasWriteAccess && <th />}
          </tr>
        </thead>
        <tbody>
          {filteredUsers.length === 0 && (
            <tr>
              <td
                className="text-center"
                colSpan={
                  tHeadRowRef.current?.querySelectorAll('th').length ?? 0
                }
              >
                <small>{t('no_members')}</small>
              </td>
            </tr>
          )}
          {usersForCurrentPage.map(user => (
            <MemberRow
              key={user.email}
              user={user}
              openOffboardingModalForUser={setUserToOffboard}
              openRemoveModalForUser={setUserToRemove}
              openUnlinkUserModal={setUserToUnlink}
              setGroupUserAlert={setGroupUserAlert}
              groupId={groupId}
              hasWriteAccess={hasWriteAccess}
            />
          ))}
        </tbody>
      </OLTable>
      <div className="mt-3">
        <div className="text-center">
          <p>
            <span aria-live="polite" data-testid="x-of-n-users">
              {t('showing_x_out_of_n_users', {
                x: usersForCurrentPage.length,
                n: filteredUsers.length,
              })}
            </span>
          </p>
        </div>
      </div>

      {pagination.totalPages > 1 && (
        <div className="d-flex justify-content-center">
          <Pagination
            handlePageClick={handlePageClick}
            currentPage={pagination.currPage}
            totalPages={pagination.totalPages}
          />
        </div>
      )}
      {userToOffboard && (
        <OffboardManagedUserModal
          user={userToOffboard}
          groupId={groupId}
          allMembers={users}
          onClose={() => setUserToOffboard(undefined)}
        />
      )}
      {userToRemove && (
        <RemoveManagedUserModal
          user={userToRemove}
          groupId={groupId}
          onClose={() => setUserToRemove(undefined)}
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
