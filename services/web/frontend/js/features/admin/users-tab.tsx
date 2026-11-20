import { FormEvent, useCallback, useEffect, useState } from 'react'
import { getUserFacingMessage } from '@/infrastructure/fetch-json'
import MaterialIcon from '@/shared/components/material-icon'
import Notification from '@/shared/components/notification'
import OLButton from '@/shared/components/ol/ol-button'
import {
  OLDropdown,
  OLDropdownDivider,
  OLDropdownItem,
  OLDropdownMenu,
  OLDropdownToggle,
} from '@/shared/components/ol/ol-dropdown-menu'
import OLForm from '@/shared/components/ol/ol-form'
import OLFormCheckbox from '@/shared/components/ol/ol-form-checkbox'
import OLFormControl from '@/shared/components/ol/ol-form-control'
import OLFormGroup from '@/shared/components/ol/ol-form-group'
import OLFormLabel from '@/shared/components/ol/ol-form-label'
import OLFormText from '@/shared/components/ol/ol-form-text'
import {
  OLModal,
  OLModalBody,
  OLModalFooter,
  OLModalHeader,
  OLModalTitle,
} from '@/shared/components/ol/ol-modal'
import OLSpinner from '@/shared/components/ol/ol-spinner'
import { useFeatureFlag } from '@/shared/context/split-test-context'
import { useUserContext } from '@/shared/context/user-context'
import roles from '@/features/settings/data/roles'
import {
  AdminUser,
  createAdminUser,
  deleteAdminUser,
  generateUserResetLink,
  listAdminUsers,
  updateAdminUser,
} from './api'

export type UserFilter = 'all' | 'admins' | 'active' | 'suspended'

type UsersTabProps = {
  initialFilter?: UserFilter
  onUsersMutated: () => void
}

const PAGE_SIZE = 20

function formatShortDate(iso: string | null): string {
  if (!iso) return '-'
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  } catch {
    return '-'
  }
}

export default function UsersTab({
  initialFilter = 'all',
  onUsersMutated,
}: UsersTabProps) {
  const currentUser = useUserContext()
  const themedModals = useFeatureFlag('themed-modals')

  const [users, setUsers] = useState<AdminUser[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [searchInput, setSearchInput] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [filter, setFilter] = useState<UserFilter>(initialFilter)
  const [isLoading, setIsLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [statusMsg, setStatusMsg] = useState<string | null>(null)

  useEffect(() => {
    setFilter(initialFilter)
    setPage(1)
  }, [initialFilter])

  // Add user modal state
  const [showAddModal, setShowAddModal] = useState(false)
  const [addEmail, setAddEmail] = useState('')
  const [addPassword, setAddPassword] = useState('')
  const [addFullName, setAddFullName] = useState('')
  const [addRole, setAddRole] = useState('')
  const [addInstitution, setAddInstitution] = useState('')
  const [addIsAdmin, setAddIsAdmin] = useState(false)
  const [addSubmitting, setAddSubmitting] = useState(false)
  const [addError, setAddError] = useState<string | null>(null)
  const [generatedLinkModal, setGeneratedLinkModal] = useState<{
    title: string
    email: string
    url: string
  } | null>(null)
  const [linkCopied, setLinkCopied] = useState(false)

  // Edit user modal state
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null)
  const [editFirstName, setEditFirstName] = useState('')
  const [editLastName, setEditLastName] = useState('')
  const [editRole, setEditRole] = useState('')
  const [editInstitution, setEditInstitution] = useState('')
  const [editPassword, setEditPassword] = useState('')
  const [editIsAdmin, setEditIsAdmin] = useState(false)
  const [editSuspended, setEditSuspended] = useState(false)
  const [editSubmitting, setEditSubmitting] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)

  // Delete confirmation modal
  const [deletingUser, setDeletingUser] = useState<AdminUser | null>(null)
  const [deleteSubmitting, setDeleteSubmitting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchInput.trim())
      setPage(1)
    }, 250)
    return () => clearTimeout(timer)
  }, [searchInput])

  const loadUsers = useCallback(async () => {
    setIsLoading(true)
    setErrorMsg(null)
    try {
      const res = await listAdminUsers({
        search: debouncedSearch,
        filter,
        page,
        limit: PAGE_SIZE,
      })
      setUsers(res.users)
      setTotal(res.total)
      setPage(res.page)
      setTotalPages(res.totalPages)
    } catch (err) {
      setErrorMsg(String(getUserFacingMessage(err as Error)))
    } finally {
      setIsLoading(false)
    }
  }, [debouncedSearch, filter, page])

  useEffect(() => {
    loadUsers()
  }, [loadUsers])

  const openAddModal = () => {
    setAddEmail('')
    setAddPassword('')
    setAddFullName('')
    setAddRole('')
    setAddInstitution('')
    setAddIsAdmin(false)
    setAddError(null)
    setShowAddModal(true)
  }

  const handleAddSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setAddSubmitting(true)
    setAddError(null)
    setStatusMsg(null)
    try {
      const res = await createAdminUser({
        email: addEmail.trim(),
        password: addPassword || undefined,
        fullName: addFullName.trim() || undefined,
        role: addRole.trim() || undefined,
        institution: addInstitution.trim() || undefined,
        isAdmin: addIsAdmin,
      })
      setShowAddModal(false)
      setStatusMsg(`Created account for ${res.user.email}.`)
      if (res.activationUrl) {
        setLinkCopied(false)
        setGeneratedLinkModal({
          title: 'Account Activation Link',
          email: res.user.email,
          url: res.activationUrl,
        })
      }
      await loadUsers()
      onUsersMutated()
    } catch (err) {
      setAddError(String(getUserFacingMessage(err as Error)))
    } finally {
      setAddSubmitting(false)
    }
  }

  const openEditModal = (u: AdminUser) => {
    setEditingUser(u)
    setEditFirstName(u.first_name)
    setEditLastName(u.last_name)
    setEditRole(u.role)
    setEditInstitution(u.institution)
    setEditPassword('')
    setEditIsAdmin(u.isAdmin)
    setEditSuspended(u.suspended)
    setEditError(null)
  }

  const handleEditSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!editingUser) return
    setEditSubmitting(true)
    setEditError(null)
    setStatusMsg(null)
    try {
      const res = await updateAdminUser(editingUser.id, {
        first_name: editFirstName.trim(),
        last_name: editLastName.trim(),
        role: editRole.trim(),
        institution: editInstitution.trim(),
        isAdmin: editIsAdmin,
        suspended: editSuspended,
        ...(editPassword ? { password: editPassword } : {}),
      })
      setEditingUser(null)
      setStatusMsg(`Updated ${res.user.email}.`)
      await loadUsers()
      onUsersMutated()
    } catch (err) {
      setEditError(String(getUserFacingMessage(err as Error)))
    } finally {
      setEditSubmitting(false)
    }
  }

  const handleQuickSuspendToggle = async (u: AdminUser) => {
    setErrorMsg(null)
    setStatusMsg(null)
    try {
      const res = await updateAdminUser(u.id, { suspended: !u.suspended })
      setStatusMsg(
        res.user.suspended
          ? `Suspended ${res.user.email}.`
          : `Reactivated ${res.user.email}.`
      )
      await loadUsers()
      onUsersMutated()
    } catch (err) {
      setErrorMsg(String(getUserFacingMessage(err as Error)))
    }
  }

  const handleResetLink = async (u: AdminUser) => {
    setErrorMsg(null)
    try {
      const res = await generateUserResetLink(u.id)
      setLinkCopied(false)
      setGeneratedLinkModal({
        title: 'Password Reset Link',
        email: res.email,
        url: res.resetUrl,
      })
    } catch (err) {
      setErrorMsg(String(getUserFacingMessage(err as Error)))
    }
  }

  const handleConfirmDelete = async () => {
    if (!deletingUser) return
    setDeleteSubmitting(true)
    setDeleteError(null)
    setStatusMsg(null)
    try {
      await deleteAdminUser(deletingUser.id)
      const deletedEmail = deletingUser.email
      setDeletingUser(null)
      setStatusMsg(`Deleted user ${deletedEmail}.`)
      await loadUsers()
      onUsersMutated()
    } catch (err) {
      setDeleteError(String(getUserFacingMessage(err as Error)))
    } finally {
      setDeleteSubmitting(false)
    }
  }

  const handleCopyGeneratedLink = () => {
    if (!generatedLinkModal) return
    navigator.clipboard
      ?.writeText(generatedLinkModal.url)
      .then(() => setLinkCopied(true))
      .catch(() => {})
  }

  const rangeStart = users.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1
  const rangeEnd = users.length === 0 ? 0 : (page - 1) * PAGE_SIZE + users.length

  return (
    <>
      <section className="ol-admin-panel ol-admin-panel--table">
        <div className="ol-admin-toolbar">
          <div className="ol-admin-toolbar-left">
            <div className="ol-admin-search-wrap">
              <OLFormControl
                type="text"
                role="searchbox"
                placeholder="Search name, email, role, organization…"
                aria-label="Search users"
                value={searchInput}
                onChange={e => setSearchInput(e.target.value)}
                prepend={
                  <MaterialIcon
                    type="search"
                    className="ol-admin-muted"
                  />
                }
                append={
                  searchInput ? (
                    <button
                      type="button"
                      className="form-control-search-clear-btn"
                      aria-label="Clear search"
                      onClick={() => setSearchInput('')}
                    >
                      <MaterialIcon type="close" />
                    </button>
                  ) : undefined
                }
              />
            </div>

            <div
              className="ol-admin-filter-group"
              role="group"
              aria-label="Filter users"
            >
              {(
                [
                  ['all', 'All'],
                  ['admins', 'Admins'],
                  ['active', 'Active'],
                  ['suspended', 'Suspended'],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  aria-pressed={filter === key}
                  className={`ol-admin-filter-btn ${
                    filter === key ? 'is-active' : ''
                  }`}
                  onClick={() => {
                    setFilter(key)
                    setPage(1)
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <OLButton
            variant="primary"
            type="button"
            leadingIcon="person_add"
            onClick={openAddModal}
          >
            Add user
          </OLButton>
        </div>

        {(statusMsg || errorMsg) && (
          <div className="ol-admin-panel-body pb-0">
            {statusMsg && (
              <div className="notification-list mb-3">
                <Notification type="success" content={statusMsg} />
              </div>
            )}
            {errorMsg && (
              <div className="notification-list mb-3">
                <Notification type="error" content={errorMsg} />
              </div>
            )}
          </div>
        )}

        {isLoading ? (
          <div className="d-flex align-items-center gap-2 p-4 ol-admin-muted">
            <OLSpinner size="sm" />
            <span>Loading users…</span>
          </div>
        ) : users.length === 0 ? (
          <div className="ol-admin-panel-body">
            <div className="ol-admin-empty-box">
              No users matched the current search or filter.
            </div>
          </div>
        ) : (
          <div className="ol-admin-table-wrap">
            <table className="table ol-admin-table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Profession / Organization</th>
                  <th>Access</th>
                  <th>Status</th>
                  <th className="text-end">Projects</th>
                  <th>Joined</th>
                  <th className="text-end">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map(u => {
                  const isSelf = String(u.id) === String(currentUser.id)
                  const profileParts = [u.role, u.institution].filter(Boolean)
                  return (
                    <tr key={u.id}>
                      <td>
                        <div className="ol-admin-user-name" translate="no">
                          <span>{u.fullName || u.email}</span>
                          {isSelf ? (
                            <span className="ol-admin-self-note">(You)</span>
                          ) : null}
                        </div>
                        <div className="ol-admin-user-email" translate="no">
                          {u.email}
                        </div>
                      </td>
                      <td>
                        {profileParts.length > 0 ? (
                          profileParts.join(', ')
                        ) : (
                          <span className="ol-admin-muted">-</span>
                        )}
                      </td>
                      <td>
                        {u.isAdmin ? (
                          <span className="ol-admin-access-admin">
                            Administrator
                          </span>
                        ) : (
                          <span className="ol-admin-muted">Member</span>
                        )}
                      </td>
                      <td>
                        {u.suspended ? (
                          <span className="ol-admin-tag ol-admin-tag--danger">
                            Suspended
                          </span>
                        ) : (
                          <span className="ol-admin-status">
                            <span
                              className="ol-admin-status-dot is-healthy"
                              aria-hidden="true"
                            />
                            <span>Active</span>
                          </span>
                        )}
                      </td>
                      <td className="text-end">{u.projectCount}</td>
                      <td className="text-nowrap">
                        {formatShortDate(u.signUpDate)}
                      </td>
                      <td className="text-end">
                        <div className="ol-admin-row-actions">
                          <OLButton
                            variant="secondary"
                            size="sm"
                            type="button"
                            onClick={() => openEditModal(u)}
                          >
                            Edit
                          </OLButton>
                          <OLDropdown align="end">
                            <OLDropdownToggle
                              id={`admin-user-actions-${u.id}`}
                              bsPrefix="dropdown-table-button-toggle"
                              variant="link"
                            >
                              <MaterialIcon
                                type="more_vert"
                                accessibilityLabel={`More actions for ${u.email}`}
                              />
                            </OLDropdownToggle>
                            <OLDropdownMenu
                              popperConfig={{ strategy: 'fixed' }}
                            >
                              <li role="none">
                                <OLDropdownItem
                                  as="button"
                                  type="button"
                                  leadingIcon="key"
                                  onClick={() => handleResetLink(u)}
                                >
                                  Copy reset link
                                </OLDropdownItem>
                              </li>
                              <li role="none">
                                <OLDropdownItem
                                  as="button"
                                  type="button"
                                  leadingIcon={
                                    u.suspended ? 'person_check' : 'person_off'
                                  }
                                  disabled={isSelf}
                                  onClick={() => handleQuickSuspendToggle(u)}
                                >
                                  {u.suspended
                                    ? 'Reactivate account'
                                    : 'Suspend account'}
                                </OLDropdownItem>
                              </li>
                              <OLDropdownDivider />
                              <li role="none">
                                <OLDropdownItem
                                  as="button"
                                  type="button"
                                  leadingIcon="delete"
                                  className="ol-admin-dropdown-danger"
                                  disabled={isSelf}
                                  onClick={() => {
                                    setDeleteError(null)
                                    setDeletingUser(u)
                                  }}
                                >
                                  Delete user
                                </OLDropdownItem>
                              </li>
                            </OLDropdownMenu>
                          </OLDropdown>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="ol-admin-pagination">
          <span>
            {total === 0
              ? 'Showing 0 users'
              : `Showing ${rangeStart}-${rangeEnd} of ${total} user${
                  total === 1 ? '' : 's'
                }`}
          </span>
          <div className="d-flex align-items-center gap-2">
            <OLButton
              variant="secondary"
              size="sm"
              type="button"
              disabled={page <= 1 || isLoading}
              onClick={() => setPage(p => Math.max(1, p - 1))}
            >
              Previous
            </OLButton>
            <span>
              Page {page} of {totalPages}
            </span>
            <OLButton
              variant="secondary"
              size="sm"
              type="button"
              disabled={page >= totalPages || isLoading}
              onClick={() => setPage(p => p + 1)}
            >
              Next
            </OLButton>
          </div>
        </div>
      </section>

      {/* Add User Modal */}
      <OLModal
        animation
        show={showAddModal}
        onHide={() => !addSubmitting && setShowAddModal(false)}
        backdrop="static"
        themed={themedModals}
      >
        <OLModalHeader closeButton>
          <OLModalTitle>Add Workspace User</OLModalTitle>
        </OLModalHeader>
        <OLModalBody>
          {addError && (
            <div className="notification-list mb-3">
              <Notification type="error" content={addError} />
            </div>
          )}
          <OLForm id="admin-add-user-form" onSubmit={handleAddSubmit}>
            <OLFormGroup controlId="admin-add-email">
              <OLFormLabel>Email</OLFormLabel>
              <OLFormControl
                type="email"
                required
                value={addEmail}
                onChange={e => setAddEmail(e.target.value)}
                placeholder="user@organization.org"
                disabled={addSubmitting}
              />
            </OLFormGroup>
            <OLFormGroup controlId="admin-add-password">
              <OLFormLabel>Initial password (optional)</OLFormLabel>
              <OLFormControl
                type="password"
                value={addPassword}
                onChange={e => setAddPassword(e.target.value)}
                placeholder="Optional"
                disabled={addSubmitting}
              />
              <OLFormText>
                Leave blank to generate a one-time 7-day activation link.
              </OLFormText>
            </OLFormGroup>
            <OLFormGroup controlId="admin-add-fullname">
              <OLFormLabel>Full name (optional)</OLFormLabel>
              <OLFormControl
                type="text"
                maxLength={255}
                value={addFullName}
                onChange={e => setAddFullName(e.target.value)}
                placeholder="e.g. Dr. Ada Lovelace"
                disabled={addSubmitting}
              />
            </OLFormGroup>
            <div className="ol-admin-modal-grid">
              <OLFormGroup controlId="admin-add-role">
                <OLFormLabel>Profession / role</OLFormLabel>
                <OLFormControl
                  type="text"
                  maxLength={120}
                  list="admin-user-role-suggestions"
                  value={addRole}
                  onChange={e => setAddRole(e.target.value)}
                  placeholder="Researcher, Student…"
                  disabled={addSubmitting}
                />
              </OLFormGroup>
              <OLFormGroup controlId="admin-add-institution">
                <OLFormLabel>Organization</OLFormLabel>
                <OLFormControl
                  type="text"
                  maxLength={160}
                  value={addInstitution}
                  onChange={e => setAddInstitution(e.target.value)}
                  placeholder="University / Company"
                  disabled={addSubmitting}
                />
              </OLFormGroup>
            </div>
            <OLFormCheckbox
              id="admin-add-is-admin"
              label="Grant administrator privileges"
              checked={addIsAdmin}
              onChange={e => setAddIsAdmin(e.target.checked)}
              disabled={addSubmitting}
            />
          </OLForm>
        </OLModalBody>
        <OLModalFooter>
          <OLButton
            variant="secondary"
            type="button"
            disabled={addSubmitting}
            onClick={() => setShowAddModal(false)}
          >
            Cancel
          </OLButton>
          <OLButton
            variant="primary"
            type="submit"
            form="admin-add-user-form"
            isLoading={addSubmitting}
            loadingLabel="Creating…"
          >
            Create user
          </OLButton>
        </OLModalFooter>
      </OLModal>

      {/* Edit User Modal */}
      <OLModal
        animation
        show={Boolean(editingUser)}
        onHide={() => !editSubmitting && setEditingUser(null)}
        backdrop="static"
        themed={themedModals}
      >
        <OLModalHeader closeButton>
          <OLModalTitle>
            Edit User{editingUser ? `: ${editingUser.email}` : ''}
          </OLModalTitle>
        </OLModalHeader>
        <OLModalBody>
          {editError && (
            <div className="notification-list mb-3">
              <Notification type="error" content={editError} />
            </div>
          )}
          <OLForm id="admin-edit-user-form" onSubmit={handleEditSubmit}>
            <div className="ol-admin-modal-grid">
              <OLFormGroup controlId="admin-edit-first-name">
                <OLFormLabel>First name</OLFormLabel>
                <OLFormControl
                  type="text"
                  maxLength={255}
                  value={editFirstName}
                  onChange={e => setEditFirstName(e.target.value)}
                  disabled={editSubmitting}
                />
              </OLFormGroup>
              <OLFormGroup controlId="admin-edit-last-name">
                <OLFormLabel>Last name</OLFormLabel>
                <OLFormControl
                  type="text"
                  maxLength={255}
                  value={editLastName}
                  onChange={e => setEditLastName(e.target.value)}
                  disabled={editSubmitting}
                />
              </OLFormGroup>
            </div>
            <div className="ol-admin-modal-grid">
              <OLFormGroup controlId="admin-edit-role">
                <OLFormLabel>Profession / role</OLFormLabel>
                <OLFormControl
                  type="text"
                  maxLength={120}
                  list="admin-user-role-suggestions"
                  value={editRole}
                  onChange={e => setEditRole(e.target.value)}
                  disabled={editSubmitting}
                />
              </OLFormGroup>
              <OLFormGroup controlId="admin-edit-institution">
                <OLFormLabel>Organization</OLFormLabel>
                <OLFormControl
                  type="text"
                  maxLength={160}
                  value={editInstitution}
                  onChange={e => setEditInstitution(e.target.value)}
                  disabled={editSubmitting}
                />
              </OLFormGroup>
            </div>
            <OLFormGroup controlId="admin-edit-password">
              <OLFormLabel>New password (optional)</OLFormLabel>
              <OLFormControl
                type="password"
                value={editPassword}
                onChange={e => setEditPassword(e.target.value)}
                placeholder="Optional"
                disabled={editSubmitting}
              />
              <OLFormText>
                Leave blank to keep this user&apos;s current password.
              </OLFormText>
            </OLFormGroup>
            <div className="d-flex flex-column gap-2">
              <OLFormCheckbox
                id="admin-edit-is-admin"
                label="Administrator privileges"
                checked={editIsAdmin}
                disabled={
                  editSubmitting ||
                  String(editingUser?.id) === String(currentUser.id)
                }
                onChange={e => setEditIsAdmin(e.target.checked)}
              />
              <OLFormCheckbox
                id="admin-edit-suspended"
                label="Suspend account (blocks sign-in and clears active sessions)"
                checked={editSuspended}
                disabled={
                  editSubmitting ||
                  String(editingUser?.id) === String(currentUser.id)
                }
                onChange={e => setEditSuspended(e.target.checked)}
              />
            </div>
          </OLForm>
        </OLModalBody>
        <OLModalFooter>
          <OLButton
            variant="secondary"
            type="button"
            disabled={editSubmitting}
            onClick={() => setEditingUser(null)}
          >
            Cancel
          </OLButton>
          <OLButton
            variant="primary"
            type="submit"
            form="admin-edit-user-form"
            isLoading={editSubmitting}
            loadingLabel="Saving…"
          >
            Save changes
          </OLButton>
        </OLModalFooter>
      </OLModal>

      {/* One-Time Link Modal (Activation / Password Reset) */}
      <OLModal
        animation
        show={Boolean(generatedLinkModal)}
        onHide={() => setGeneratedLinkModal(null)}
        themed={themedModals}
      >
        <OLModalHeader closeButton>
          <OLModalTitle>{generatedLinkModal?.title}</OLModalTitle>
        </OLModalHeader>
        <OLModalBody>
          <p className="mb-3">
            Share this one-time 7-day link securely with{' '}
            <strong>{generatedLinkModal?.email}</strong>:
          </p>
          <div className="ol-admin-link-box">
            <code translate="no">{generatedLinkModal?.url}</code>
            <OLButton
              variant="secondary"
              size="sm"
              type="button"
              leadingIcon={linkCopied ? 'check' : 'content_copy'}
              onClick={handleCopyGeneratedLink}
            >
              {linkCopied ? 'Copied' : 'Copy'}
            </OLButton>
          </div>
        </OLModalBody>
        <OLModalFooter>
          <OLButton
            variant="primary"
            type="button"
            onClick={() => setGeneratedLinkModal(null)}
          >
            Done
          </OLButton>
        </OLModalFooter>
      </OLModal>

      {/* Delete Confirmation Modal */}
      <OLModal
        animation
        show={Boolean(deletingUser)}
        onHide={() => !deleteSubmitting && setDeletingUser(null)}
        backdrop="static"
        themed={themedModals}
      >
        <OLModalHeader closeButton>
          <OLModalTitle>Delete User Account</OLModalTitle>
        </OLModalHeader>
        <OLModalBody>
          {deleteError && (
            <div className="notification-list mb-3">
              <Notification type="error" content={deleteError} />
            </div>
          )}
          <div className="notification-list mb-3">
            <Notification
              type="warning"
              content="Deleting an account permanently removes its owned projects and cannot be undone."
            />
          </div>
          <p className="mb-0">
            Permanently delete <strong>{deletingUser?.email}</strong> and all{' '}
            {deletingUser?.projectCount ?? 0} owned project(s)?
          </p>
        </OLModalBody>
        <OLModalFooter>
          <OLButton
            variant="secondary"
            type="button"
            disabled={deleteSubmitting}
            onClick={() => setDeletingUser(null)}
          >
            Cancel
          </OLButton>
          <OLButton
            variant="danger"
            type="button"
            isLoading={deleteSubmitting}
            loadingLabel="Deleting…"
            onClick={handleConfirmDelete}
          >
            Delete user
          </OLButton>
        </OLModalFooter>
      </OLModal>

      <datalist id="admin-user-role-suggestions">
        {roles.map(r => (
          <option key={r} value={r} />
        ))}
      </datalist>
    </>
  )
}
