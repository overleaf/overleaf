import classNames from 'classnames'
import moment from 'moment'
import { useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { User } from '@ol-types/group-management/user'

import MaterialIcon from '@/shared/components/material-icon'
import OLButton from '@/shared/components/ol/ol-button'
import OLCard from '@/shared/components/ol/ol-card'
import OLCol from '@/shared/components/ol/ol-col'
import OLFormCheckbox from '@/shared/components/ol/ol-form-checkbox'
import OLFormSelect from '@/shared/components/ol/ol-form-select'
import OLNotification from '@/shared/components/ol/ol-notification'
import OLRow from '@/shared/components/ol/ol-row'
import OLTable from '@/shared/components/ol/ol-table'
import OLTag from '@/shared/components/ol/ol-tag'

import getMeta from '@/utils/meta'

import BackButton from './back-button'
import { useGroupMembersContext } from '../context/group-members-context'
import OffboardManagedUserModal from './members-table/offboard-managed-user-modal'
import RemoveManagedUserModal from './members-table/remove-managed-user-modal'
import UnlinkUserModal from './members-table/unlink-user-modal'
import { GroupUserAlert } from '../utils/types'
import DropdownButton from './members-table/dropdown-button'
import {
  OLModal,
  OLModalBody,
  OLModalFooter,
  OLModalHeader,
  OLModalTitle,
} from '@/shared/components/ol/ol-modal'

const getUserRole = (user: User) =>
  user.isEntityAdmin ? 'admin' : user.isEntityManager ? 'manager' : 'member'

export default function GroupUsers() {
  const { t } = useTranslation()
  const groupName = getMeta('ol-groupName')
  const groupId = getMeta('ol-groupId')
  const groupSize = getMeta('ol-groupSize')
  const canUseAddSeatsFeature = getMeta('ol-canUseAddSeatsFeature')
  const groupSSOActive = getMeta('ol-groupSSOActive')
  const managedUsersActive = getMeta('ol-managedUsersActive')
  const hasWriteAccess = getMeta('ol-hasWriteAccess')
  const ownUserId = getMeta('ol-user_id')
  const [userToOffboard, setUserToOffboard] = useState<User | undefined>(
    undefined
  )
  const [userToRemove, setUserToRemove] = useState<User | undefined>(undefined)
  const [userToUnlink, setUserToUnlink] = useState<User | undefined>(undefined)
  const [_groupUserAlert, setGroupUserAlert] =
    useState<GroupUserAlert>(undefined)

  const {
    users,
    selectedUsers,
    setSelectedUsers,
    selectUser,
    unselectUser,
    addManager,
    removeManager,
    addMembers,
    removeMember,
  } = useGroupMembersContext()
  const [page, setPage] = useState(1)
  const numPages = Math.ceil(users.length / 10)

  const paginatedUsers = useMemo(() => {
    const firstUser = (page - 1) * 10
    const lastUser = Math.min(page * 10, users.length)
    return users.slice(firstUser, lastUser)
  }, [users, page])

  const visibleNonMangedUsers = useMemo(
    () => paginatedUsers.filter(user => !user.enrollment?.managedBy),
    [paginatedUsers]
  )

  const handleSelectAll = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.checked) {
        setSelectedUsers(visibleNonMangedUsers)
      } else {
        setSelectedUsers([])
      }
    },
    [visibleNonMangedUsers, setSelectedUsers]
  )

  const handleSelectUser = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>, user: User) => {
      if (e.target.checked) {
        selectUser(user)
      } else {
        unselectUser(user)
      }
    },
    [selectUser, unselectUser]
  )

  const handleChangeRole = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>, user: User) => {
      if (e.target.value === 'manager') {
        addManager(user.email)
      } else if (e.target.value === 'member') {
        if (user.isEntityManager) {
          removeManager(user, true)
        }
        if (!user.isEntityMember && !user.invite) {
          addMembers(user.email)
        }
      }
    },
    [addManager, removeManager, addMembers]
  )

  const handleRemoveUser = (user: User) => {
    if (user.isEntityManager) {
      removeManager(user)
    }
    if (user.isEntityMember || user.invite) {
      removeMember(user)
    }
    setUserToRemove(undefined)
  }

  const allocatedLicenses = users.filter(
    user => user.isEntityMember || user.invite
  ).length

  return (
    <div className="container group-users-container">
      <OLRow>
        <OLCol>
          <div className="group-heading">
            <BackButton
              href="/user/subscription"
              accessibilityLabel={t('back_to_subscription')}
            />
            <h1 className="heading">{groupName || t('group_subscription')}</h1>
          </div>
        </OLCol>
      </OLRow>
      <OLCard>
        <OLRow className="justify-content-between">
          <OLCol xs="auto">
            <h2 className="page-title">{t('user_management')}</h2>
            <a href="/" className="learn-more">
              {t('learn_more_about_roles_permissions')}
            </a>
          </OLCol>
          <OLCol xs="auto" className="align-content-center">
            <OLButton disabled={allocatedLicenses <= groupSize}>
              {t('invite_users')}
            </OLButton>
          </OLCol>
        </OLRow>

        <OLRow className="license-info">
          <OLNotification
            type="info"
            content={
              allocatedLicenses === 1
                ? t('you_have_1_license_and_your_plan_supports_up_to_y', {
                    groupSize,
                  })
                : t('you_have_x_licenses_and_your_plan_supports_up_to_y', {
                    addedUsersSize: allocatedLicenses,
                    groupSize,
                  })
            }
            action={
              canUseAddSeatsFeature ? (
                <a
                  href="/user/subscription/group/add-users"
                  className={classNames({
                    'btn btn-premium': allocatedLicenses === groupSize,
                  })}
                >
                  {t('buy_more_licenses')}
                </a>
              ) : undefined
            }
          />
        </OLRow>

        <OLRow>
          <OLCol>
            <OLTable hover responsive bordered>
              <thead>
                <tr>
                  <th>
                    {hasWriteAccess && visibleNonMangedUsers.length > 0 && (
                      <OLFormCheckbox
                        autoComplete="off"
                        onChange={handleSelectAll}
                        checked={
                          selectedUsers.length === visibleNonMangedUsers.length
                        }
                        aria-label={t('select_all')}
                      />
                    )}
                  </th>
                  <th>{t('email')}</th>
                  <th>{t('name')}</th>
                  <th>{t('last_active')}</th>
                  <th>{t('role')}</th>
                  <th className="text-center">{t('license')}</th>
                  {groupSSOActive && (
                    <th className="text-center">{t('sso')}</th>
                  )}
                  {managedUsersActive && (
                    <th className="text-center">{t('managed')}</th>
                  )}
                  {hasWriteAccess && <th />}
                </tr>
              </thead>
              <tbody>
                {paginatedUsers.map(user => (
                  <tr key={user.email} className="align-middle">
                    <td>
                      {hasWriteAccess &&
                        !user.enrollment?.managedBy &&
                        !user.isEntityAdmin &&
                        user._id !== ownUserId && (
                          <OLFormCheckbox
                            autoComplete="off"
                            onChange={e => handleSelectUser(e, user)}
                            checked={selectedUsers.includes(user)}
                            aria-label={t('select_user')}
                          />
                        )}
                    </td>
                    <td>{user.email}</td>
                    <td className="text-nowrap">
                      {user.first_name} {user.last_name}
                    </td>
                    <td className="text-nowrap">
                      {user.last_active_at ? (
                        moment(user.last_active_at).format('Do MMM YYYY')
                      ) : (
                        <OLTag>{t('pending_invite')}</OLTag>
                      )}
                    </td>
                    <td>
                      <OLFormSelect
                        aria-label={t('select_user_role')}
                        name="user-role"
                        defaultValue={getUserRole(user)}
                        className="user-role-select"
                        onChange={e => handleChangeRole(e, user)}
                        disabled={
                          !hasWriteAccess ||
                          user.isEntityAdmin ||
                          user._id === null ||
                          user._id === ownUserId
                        }
                      >
                        <option value="admin" hidden>
                          {t('admin_titlecase')}
                        </option>
                        <option value="manager">{t('manager')}</option>
                        <option value="member">{t('member')}</option>
                      </OLFormSelect>
                    </td>
                    <td className="text-center">
                      {user.isEntityMember ? (
                        <MaterialIcon
                          type="check"
                          className="text-success"
                          accessibilityLabel={t('license_allocated')}
                        />
                      ) : user.invite ? (
                        <MaterialIcon
                          type="schedule"
                          className="text-warning"
                          accessibilityLabel={t('pending_invite')}
                        />
                      ) : (
                        <MaterialIcon
                          type="close"
                          className="text-danger"
                          accessibilityLabel={t('license_not_allocated')}
                        />
                      )}
                    </td>
                    {groupSSOActive && (
                      <td className="text-center">
                        {user.enrollment?.sso?.some(
                          sso => sso.groupId === groupId
                        ) ? (
                          <MaterialIcon
                            type="check"
                            className="text-success"
                            accessibilityLabel={t('sso_active')}
                          />
                        ) : (
                          <MaterialIcon
                            type="close"
                            className="text-danger"
                            accessibilityLabel={t('sso_not_active')}
                          />
                        )}
                      </td>
                    )}
                    {managedUsersActive && (
                      <td className="text-center">
                        {user.enrollment?.managedBy === groupId ? (
                          <MaterialIcon
                            type="check"
                            className="text-success"
                            accessibilityLabel={t('managed')}
                          />
                        ) : (
                          <MaterialIcon
                            type="close"
                            className="text-danger"
                            accessibilityLabel={t('not_managed')}
                          />
                        )}
                      </td>
                    )}
                    <td className="cell-dropdown">
                      {hasWriteAccess &&
                        !user.isEntityAdmin &&
                        user._id !== ownUserId && (
                          <DropdownButton
                            user={user}
                            openOffboardingModalForUser={setUserToOffboard}
                            openRemoveModalForUser={setUserToRemove}
                            openUnlinkUserModal={setUserToUnlink}
                            setGroupUserAlert={setGroupUserAlert}
                            groupId={groupId}
                            combinedUserManagement
                          />
                        )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </OLTable>
          </OLCol>
        </OLRow>
        <OLRow className="justify-content-between align-items-center">
          <OLCol xs="auto" className="ms-3">
            <p className="mb-0">
              {t('showing_x_out_of_n_users', {
                x: paginatedUsers.length,
                n: users.length,
              })}
            </p>
          </OLCol>
          <OLCol xs="auto" className="pagination-container">
            <OLButton
              variant="ghost"
              disabled={page === 1}
              onClick={() => setPage(1)}
            >
              <MaterialIcon
                type="first_page"
                accessibilityLabel={t('go_to_first_page')}
              />
            </OLButton>
            <OLButton
              variant="ghost"
              disabled={page === 1}
              onClick={() => setPage(page => page - 1)}
            >
              <MaterialIcon
                type="chevron_left"
                accessibilityLabel={t('go_to_previous_page')}
              />
            </OLButton>
            <p className="d-inline-flex mb-0">
              {t('page_x_of_n', { x: page, n: numPages })}
            </p>
            <OLButton
              variant="ghost"
              disabled={page === numPages}
              onClick={() => setPage(page => page + 1)}
            >
              <MaterialIcon
                type="chevron_right"
                accessibilityLabel={t('go_to_next_page')}
              />
            </OLButton>
            <OLButton
              variant="ghost"
              disabled={page === numPages}
              onClick={() => setPage(numPages)}
            >
              <MaterialIcon
                type="last_page"
                accessibilityLabel={t('go_to_last_page')}
              />
            </OLButton>
          </OLCol>
        </OLRow>
      </OLCard>
      {userToOffboard && (
        <OffboardManagedUserModal
          user={userToOffboard}
          groupId={groupId}
          allMembers={users.filter(user => user.isEntityMember)}
          onClose={() => setUserToOffboard(undefined)}
        />
      )}
      {userToRemove &&
        (userToRemove.enrollment?.managedBy === groupId ? (
          <RemoveManagedUserModal
            user={userToRemove}
            groupId={groupId}
            onClose={() => setUserToRemove(undefined)}
          />
        ) : (
          <OLModal
            show={userToRemove !== undefined}
            onHide={() => setUserToRemove(undefined)}
          >
            <OLModalHeader>
              <OLModalTitle>Remove user from group?</OLModalTitle>
            </OLModalHeader>
            <OLModalBody>
              Are you sure you want to remove {userToRemove.email} from the
              group?
            </OLModalBody>
            <OLModalFooter>
              <OLButton
                onClick={() => setUserToRemove(undefined)}
                variant="secondary"
              >
                Cancel
              </OLButton>
              <OLButton onClick={() => handleRemoveUser(userToRemove)}>
                Remove
              </OLButton>
            </OLModalFooter>
          </OLModal>
        ))}
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
