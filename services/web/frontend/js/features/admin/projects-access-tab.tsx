import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react'
import { getUserFacingMessage } from '@/infrastructure/fetch-json'
import MaterialIcon from '@/shared/components/material-icon'
import Notification from '@/shared/components/notification'
import OLButton from '@/shared/components/ol/ol-button'
import OLForm from '@/shared/components/ol/ol-form'
import OLFormCheckbox from '@/shared/components/ol/ol-form-checkbox'
import OLFormControl from '@/shared/components/ol/ol-form-control'
import OLFormGroup from '@/shared/components/ol/ol-form-group'
import OLFormLabel from '@/shared/components/ol/ol-form-label'
import OLFormText from '@/shared/components/ol/ol-form-text'
import { Select } from '@/shared/components/select'
import {
  OLModal,
  OLModalBody,
  OLModalFooter,
  OLModalHeader,
  OLModalTitle,
} from '@/shared/components/ol/ol-modal'
import OLSpinner from '@/shared/components/ol/ol-spinner'
import { useFeatureFlag } from '@/shared/context/split-test-context'
import {
  addAdminProjectCollaborator,
  AdminMiniUser,
  AdminProjectRecord,
  AdminProjectsResponse,
  AdminUser,
  EnterpriseScope,
  listAdminProjects,
  listAdminUsers,
  PermissionMode,
  removeAdminProjectCollaborator,
  toggleAdminProjectLinkSharing,
  updateAdminProjectAccess,
  updateAdminProjectCollaborator,
} from './api'

export type ProjectFilter = 'all' | 'enterprise' | 'user_shared' | 'private'

type ProjectsAccessTabProps = {
  initialFilter?: ProjectFilter
  onProjectsMutated: () => void
}

const PAGE_SIZE = 20

const PERMISSION_LABELS: Record<PermissionMode, string> = {
  edit: 'Editor (Modify original)',
  copy: 'Viewer (Can copy)',
  view_only: 'Viewer (No copy)',
}

const SCOPE_OPTIONS: {
  key: EnterpriseScope
  label: string
  subtitle: string
}[] = [
    {
      key: 'private',
      label: 'Private (collaborators only)',
      subtitle: 'Owner & invited collaborators only',
    },
    {
      key: 'network',
      label: 'Internal network only',
      subtitle: 'LAN / VPN users only',
    },
    {
      key: 'all_users',
      label: 'All workspace users',
      subtitle: 'Every signed-in workspace user',
    },
    {
      key: 'custom',
      label: 'Custom audience',
      subtitle: 'Profession, organization, or specific users',
    },
  ]

const PERMISSION_OPTIONS: {
  key: PermissionMode
  label: string
  subtitle: string
}[] = [
    {
      key: 'copy',
      label: 'Viewer (Can copy)',
      subtitle: 'View & use as a copy',
    },
    {
      key: 'edit',
      label: 'Editor (Modify original)',
      subtitle: 'Read & write access',
    },
    {
      key: 'view_only',
      label: 'Viewer (No copy)',
      subtitle: 'View only, copying disabled',
    },
  ]

function formatScopeSummary(project: AdminProjectRecord): {
  label: string
  dotClass: string
  detail: string
} {
  const { enterpriseAccess } = project
  if (enterpriseAccess.scope === 'network') {
    return {
      label: 'Internal network',
      dotClass: 'is-healthy',
      detail:
        enterpriseAccess.allowedCidrs.length > 0
          ? `${enterpriseAccess.allowedCidrs.length} custom CIDR range(s)`
          : 'Default private LAN ranges',
    }
  }
  if (enterpriseAccess.scope === 'all_users') {
    return {
      label: enterpriseAccess.networkOnly
        ? 'All users (LAN only)'
        : 'All workspace users',
      dotClass: 'is-healthy',
      detail: enterpriseAccess.networkOnly
        ? 'Signed-in users on trusted network'
        : 'All active signed-in users',
    }
  }
  if (enterpriseAccess.scope === 'custom') {
    const parts: string[] = []
    if (enterpriseAccess.targetRoles.length > 0) {
      parts.push(`${enterpriseAccess.targetRoles.length} profession(s)`)
    }
    if (enterpriseAccess.targetInstitutions.length > 0) {
      parts.push(`${enterpriseAccess.targetInstitutions.length} organization(s)`)
    }
    if (enterpriseAccess.targetUsers.length > 0) {
      parts.push(`${enterpriseAccess.targetUsers.length} user(s)`)
    }
    return {
      label: enterpriseAccess.networkOnly ? 'Custom (LAN only)' : 'Custom audience',
      dotClass: 'is-healthy',
      detail: parts.join(', ') || 'Custom audience',
    }
  }
  return {
    label: 'Private',
    dotClass: 'is-neutral',
    detail: 'Owner & invited users only',
  }
}

export default function ProjectsAccessTab({
  initialFilter = 'all',
  onProjectsMutated,
}: ProjectsAccessTabProps) {
  const themedModals = useFeatureFlag('themed-modals')

  const [projects, setProjects] = useState<AdminProjectRecord[]>([])
  const [facets, setFacets] = useState<AdminProjectsResponse['facets'] | null>(
    null
  )
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [searchInput, setSearchInput] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [filter, setFilter] = useState<ProjectFilter>(initialFilter)
  const [isLoading, setIsLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [statusMsg, setStatusMsg] = useState<string | null>(null)

  // Manage project modal state
  const [activeProject, setActiveProject] = useState<AdminProjectRecord | null>(
    null
  )
  const [policyScope, setPolicyScope] = useState<EnterpriseScope>('private')
  const [policyMode, setPolicyMode] = useState<PermissionMode>('copy')
  const [policyNetworkOnly, setPolicyNetworkOnly] = useState(false)
  const [policyCidrsText, setPolicyCidrsText] = useState('')
  const [targetRoles, setTargetRoles] = useState<string[]>([])
  const [customRoleInput, setCustomRoleInput] = useState('')
  const [targetInstitutions, setTargetInstitutions] = useState<string[]>([])
  const [customInstInput, setCustomInstInput] = useState('')
  const [targetUsers, setTargetUsers] = useState<AdminMiniUser[]>([])
  const [targetUserSearch, setTargetUserSearch] = useState('')
  const [targetUserResults, setTargetUserResults] = useState<AdminUser[]>([])
  const [savingPolicy, setSavingPolicy] = useState(false)

  // Direct collaborator add state inside modal
  const [collabSearch, setCollabSearch] = useState('')
  const [collabSearchResults, setCollabSearchResults] = useState<AdminUser[]>([])
  const [selectedCollabUser, setSelectedCollabUser] =
    useState<AdminUser | null>(null)
  const [newCollabMode, setNewCollabMode] = useState<PermissionMode>('copy')
  const [collabBusy, setCollabBusy] = useState(false)

  const [modalError, setModalError] = useState<string | null>(null)
  const [modalSuccess, setModalSuccess] = useState<string | null>(null)

  useEffect(() => {
    setFilter(initialFilter)
    setPage(1)
  }, [initialFilter])

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchInput.trim())
      setPage(1)
    }, 250)
    return () => clearTimeout(timer)
  }, [searchInput])

  const loadProjects = useCallback(async () => {
    setIsLoading(true)
    setErrorMsg(null)
    try {
      const res = await listAdminProjects({
        search: debouncedSearch,
        filter,
        page,
        limit: PAGE_SIZE,
      })
      setProjects(res.projects)
      setFacets(res.facets)
      setTotal(res.total)
      setPage(res.page)
      setTotalPages(res.totalPages)
    } catch (err) {
      setErrorMsg(String(getUserFacingMessage(err as Error) || 'Failed to load projects'))
    } finally {
      setIsLoading(false)
    }
  }, [debouncedSearch, filter, page])

  useEffect(() => {
    loadProjects()
  }, [loadProjects])

  // Debounced user search for Custom Audience picker
  useEffect(() => {
    if (!activeProject || policyScope !== 'custom') return
    const q = targetUserSearch.trim()
    const timer = setTimeout(async () => {
      try {
        const res = await listAdminUsers({
          search: q,
          filter: 'active',
          page: 1,
          limit: 8,
        })
        const chosenIds = new Set(targetUsers.map(u => u.id))
        const ownerId = activeProject.owner?.id
        setTargetUserResults(
          res.users.filter(u => u.id !== ownerId && !chosenIds.has(u.id))
        )
      } catch {
        setTargetUserResults([])
      }
    }, 200)
    return () => clearTimeout(timer)
  }, [activeProject, policyScope, targetUserSearch, targetUsers])

  // Debounced user search for Direct Collaborators picker
  useEffect(() => {
    if (!activeProject) return
    const q = collabSearch.trim()
    if (!q) {
      setCollabSearchResults([])
      return
    }
    const timer = setTimeout(async () => {
      try {
        const res = await listAdminUsers({
          search: q,
          filter: 'active',
          page: 1,
          limit: 8,
        })
        const existingIds = new Set([
          ...(activeProject.owner ? [activeProject.owner.id] : []),
          ...activeProject.collaborators.map(c => c.userId),
        ])
        setCollabSearchResults(res.users.filter(u => !existingIds.has(u.id)))
      } catch {
        setCollabSearchResults([])
      }
    }, 200)
    return () => clearTimeout(timer)
  }, [activeProject, collabSearch])

  const openManageModal = (project: AdminProjectRecord) => {
    setActiveProject(project)
    setPolicyScope(project.enterpriseAccess.scope)
    setPolicyMode(project.enterpriseAccess.permissionMode)
    setPolicyNetworkOnly(project.enterpriseAccess.networkOnly)
    setPolicyCidrsText(project.enterpriseAccess.allowedCidrs.join(', '))
    setTargetRoles([...project.enterpriseAccess.targetRoles])
    setTargetInstitutions([...project.enterpriseAccess.targetInstitutions])
    setTargetUsers([...project.enterpriseAccess.targetUsers])
    setCustomRoleInput('')
    setCustomInstInput('')
    setTargetUserSearch('')
    setTargetUserResults([])
    setCollabSearch('')
    setCollabSearchResults([])
    setSelectedCollabUser(null)
    setNewCollabMode('copy')
    setModalError(null)
    setModalSuccess(null)
  }

  const syncUpdatedProject = useCallback(
    (updated: AdminProjectRecord) => {
      setActiveProject(updated)
      setProjects(prev => prev.map(p => (p.id === updated.id ? updated : p)))
      onProjectsMutated()
      loadProjects()
    },
    [loadProjects, onProjectsMutated]
  )

  const toggleFacetItem = (
    item: string,
    list: string[],
    setList: (next: string[]) => void
  ) => {
    const lower = item.toLowerCase()
    if (list.some(v => v.toLowerCase() === lower)) {
      setList(list.filter(v => v.toLowerCase() !== lower))
    } else {
      setList([...list, item])
    }
  }

  const handleAddCustomRole = () => {
    const val = customRoleInput.trim()
    if (!val) return
    if (!targetRoles.some(r => r.toLowerCase() === val.toLowerCase())) {
      setTargetRoles(prev => [...prev, val])
    }
    setCustomRoleInput('')
  }

  const handleAddCustomInstitution = () => {
    const val = customInstInput.trim()
    if (!val) return
    if (!targetInstitutions.some(i => i.toLowerCase() === val.toLowerCase())) {
      setTargetInstitutions(prev => [...prev, val])
    }
    setCustomInstInput('')
  }

  const handleSavePolicy = async (e: FormEvent) => {
    e.preventDefault()
    if (!activeProject) return
    setSavingPolicy(true)
    setModalError(null)
    setModalSuccess(null)

    const parsedCidrs = policyCidrsText
      .split(/[\s,]+/)
      .map(s => s.trim())
      .filter(Boolean)

    try {
      const res = await updateAdminProjectAccess(activeProject.id, {
        scope: policyScope,
        permissionMode: policyMode,
        networkOnly: policyScope === 'network' ? true : policyNetworkOnly,
        allowedCidrs: parsedCidrs,
        targetRoles,
        targetInstitutions,
        targetUserIds: targetUsers.map(u => u.id),
      })
      syncUpdatedProject(res.project)
      setStatusMsg(`Updated access settings for "${res.project.name}".`)
      setModalSuccess('Enterprise access settings saved.')
    } catch (err) {
      setModalError(String(getUserFacingMessage(err as Error) || 'Failed to update access'))
    } finally {
      setSavingPolicy(false)
    }
  }

  const handleAddCollaborator = async () => {
    if (!activeProject) return
    const userId = selectedCollabUser?.id
    const email = !userId ? collabSearch.trim() : undefined
    if (!userId && !email) return

    setCollabBusy(true)
    setModalError(null)
    setModalSuccess(null)
    try {
      const res = await addAdminProjectCollaborator(activeProject.id, {
        ...(userId ? { userId } : { email }),
        permissionMode: newCollabMode,
      })
      syncUpdatedProject(res.project)
      setSelectedCollabUser(null)
      setCollabSearch('')
      setCollabSearchResults([])
      setModalSuccess('User added to project collaborators.')
    } catch (err) {
      setModalError(String(getUserFacingMessage(err as Error) || 'Failed to add user'))
    } finally {
      setCollabBusy(false)
    }
  }

  const handleUpdateCollaborator = async (
    userId: string,
    permissionMode: PermissionMode
  ) => {
    if (!activeProject) return
    setCollabBusy(true)
    setModalError(null)
    setModalSuccess(null)
    try {
      const res = await updateAdminProjectCollaborator(
        activeProject.id,
        userId,
        permissionMode
      )
      syncUpdatedProject(res.project)
      setModalSuccess('Collaborator permission updated.')
    } catch (err) {
      setModalError(String(getUserFacingMessage(err as Error) || 'Failed to update permission'))
    } finally {
      setCollabBusy(false)
    }
  }

  const handleRemoveCollaborator = async (userId: string) => {
    if (!activeProject) return
    setCollabBusy(true)
    setModalError(null)
    setModalSuccess(null)
    try {
      const res = await removeAdminProjectCollaborator(activeProject.id, userId)
      syncUpdatedProject(res.project)
      setModalSuccess('Collaborator access removed.')
    } catch (err) {
      setModalError(String(getUserFacingMessage(err as Error) || 'Failed to remove user'))
    } finally {
      setCollabBusy(false)
    }
  }

  const handleToggleLinkSharing = async () => {
    if (!activeProject) return
    const nextLevel: 'tokenBased' | 'private' =
      activeProject.publicAccessLevel === 'tokenBased'
        ? 'private'
        : 'tokenBased'
    setCollabBusy(true)
    setModalError(null)
    setModalSuccess(null)
    try {
      await toggleAdminProjectLinkSharing(activeProject.id, nextLevel)
      const updatedProject: AdminProjectRecord = {
        ...activeProject,
        publicAccessLevel: nextLevel,
      }
      setActiveProject(updatedProject)
      setProjects(prev =>
        prev.map(p => (p.id === updatedProject.id ? updatedProject : p))
      )
      setModalSuccess(
        nextLevel === 'tokenBased'
          ? 'Link sharing enabled for this project.'
          : 'Link sharing disabled for this project.'
      )
      onProjectsMutated()
      loadProjects()
    } catch (err) {
      setModalError(String(getUserFacingMessage(err as Error) || 'Failed to toggle link sharing'))
    } finally {
      setCollabBusy(false)
    }
  }

  const allFacetRoles = useMemo(() => {
    const combined = new Set<string>(facets?.roles || [])
    for (const r of targetRoles) combined.add(r)
    return Array.from(combined).sort((a, b) => a.localeCompare(b))
  }, [facets?.roles, targetRoles])

  const allFacetInstitutions = useMemo(() => {
    const combined = new Set<string>(facets?.institutions || [])
    for (const inst of targetInstitutions) combined.add(inst)
    return Array.from(combined).sort((a, b) => a.localeCompare(b))
  }, [facets?.institutions, targetInstitutions])

  const rangeStart = projects.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1
  const rangeEnd =
    projects.length === 0 ? 0 : (page - 1) * PAGE_SIZE + projects.length

  return (
    <>
      <section className="ol-admin-panel ol-admin-panel--table">
        <div className="ol-admin-toolbar">
          <div className="ol-admin-toolbar-left">
            <div className="ol-admin-search-wrap">
              <OLFormControl
                type="text"
                role="searchbox"
                placeholder="Search project or owner…"
                aria-label="Search workspace projects"
                value={searchInput}
                onChange={e => setSearchInput(e.target.value)}
                prepend={
                  <MaterialIcon type="search" className="ol-admin-muted" />
                }
                append={
                  searchInput ? (
                    <button
                      type="button"
                      className="form-control-search-clear-btn"
                      aria-label="Clear project search"
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
              aria-label="Filter projects by access"
            >
              {(
                [
                  [
                    'all',
                    `All${facets ? ` (${facets.counts.totalProjects})` : ''}`,
                  ],
                  [
                    'enterprise',
                    `Network / Workspace${facets ? ` (${facets.counts.enterpriseShared})` : ''
                    }`,
                  ],
                  [
                    'user_shared',
                    `User shared${facets ? ` (${facets.counts.userShared})` : ''
                    }`,
                  ],
                  [
                    'private',
                    `Private${facets ? ` (${facets.counts.privateProjects})` : ''
                    }`,
                  ],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  aria-pressed={filter === key}
                  className={`ol-admin-filter-btn ${filter === key ? 'is-active' : ''
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
            variant="ghost"
            size="sm"
            type="button"
            leadingIcon="refresh"
            isLoading={isLoading}
            loadingLabel="Loading…"
            onClick={loadProjects}
          >
            Refresh
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
            <span>Loading workspace projects…</span>
          </div>
        ) : projects.length === 0 ? (
          <div className="ol-admin-panel-body">
            <div className="ol-admin-empty-box">
              No projects matched the current search or access filter.
            </div>
          </div>
        ) : (
          <div className="ol-admin-table-wrap">
            <table className="table ol-admin-table">
              <thead>
                <tr>
                  <th>Project &amp; owner</th>
                  <th>Network / workspace access</th>
                  <th>Workspace permission</th>
                  <th>User-to-user shares</th>
                  <th className="text-end">Actions</th>
                </tr>
              </thead>
              <tbody>
                {projects.map(proj => {
                  const scopeInfo = formatScopeSummary(proj)
                  const previewNames = proj.collaborators
                    .slice(0, 2)
                    .map(c => c.fullName || c.email)
                  return (
                    <tr key={proj.id}>
                      <td>
                        <div className="ol-admin-user-name" translate="no">
                          <a href={`/project/${proj.id}`}>{proj.name}</a>
                        </div>
                        <div className="ol-admin-user-email" translate="no">
                          Owner:{' '}
                          {proj.owner
                            ? proj.owner.fullName
                              ? `${proj.owner.fullName} (${proj.owner.email})`
                              : proj.owner.email
                            : 'Unknown'}
                        </div>
                      </td>
                      <td>
                        <span className="ol-admin-status">
                          <span
                            className={`ol-admin-status-dot ${scopeInfo.dotClass}`}
                            aria-hidden="true"
                          />
                          <span>{scopeInfo.label}</span>
                        </span>
                        <div className="ol-admin-user-email">
                          {scopeInfo.detail}, Link sharing:{' '}
                          {proj.publicAccessLevel === 'tokenBased'
                            ? 'On'
                            : 'Off'}
                        </div>
                      </td>
                      <td>
                        {proj.enterpriseAccess.scope !== 'private' ? (
                          <span
                            className={
                              proj.enterpriseAccess.permissionMode === 'edit'
                                ? 'ol-admin-access-admin'
                                : ''
                            }
                          >
                            {
                              PERMISSION_LABELS[
                              proj.enterpriseAccess.permissionMode
                              ]
                            }
                          </span>
                        ) : (
                          <span className="ol-admin-muted">-</span>
                        )}
                      </td>
                      <td>
                        {proj.collaboratorCount > 0 ? (
                          <>
                            <div className="fw-medium">
                              {proj.collaboratorCount} collaborator
                              {proj.collaboratorCount === 1 ? '' : 's'}
                            </div>
                            <div className="ol-admin-user-email" translate="no">
                              {previewNames.join(', ')}
                              {proj.collaboratorCount > 2
                                ? ` +${proj.collaboratorCount - 2} more`
                                : ''}
                            </div>
                          </>
                        ) : (
                          <span className="ol-admin-muted">None</span>
                        )}
                      </td>
                      <td className="text-end">
                        <OLButton
                          variant="secondary"
                          size="sm"
                          type="button"
                          onClick={() => openManageModal(proj)}
                        >
                          Manage access
                        </OLButton>
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
              ? 'Showing 0 projects'
              : `Showing ${rangeStart}-${rangeEnd} of ${total} project${
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

      {/* Manage Project Access & Direct Sharing Modal */}
      <OLModal
        animation
        size="lg"
        show={Boolean(activeProject)}
        onHide={() => !savingPolicy && !collabBusy && setActiveProject(null)}
        backdrop="static"
        themed={themedModals}
      >
        <OLModalHeader closeButton>
          <OLModalTitle>
            Manage Project Access
            {activeProject ? `: ${activeProject.name}` : ''}
          </OLModalTitle>
        </OLModalHeader>
        <OLModalBody>
          {modalError && (
            <div className="notification-list mb-3">
              <Notification type="error" content={modalError} />
            </div>
          )}
          {modalSuccess && (
            <div className="notification-list mb-3">
              <Notification type="success" content={modalSuccess} />
            </div>
          )}

          <OLForm id="admin-project-policy-form" onSubmit={handleSavePolicy}>
            <h3 className="ol-admin-subsection-title">
              Workspace &amp; network visibility
            </h3>
            <p className="ol-admin-muted mb-3">
              Publish this project across your internal LAN, all workspace
              accounts, or selected professions, organizations, and users. Shared
              projects appear automatically under &ldquo;Shared with you&rdquo;.
            </p>

            <div className="ol-admin-modal-grid">
              <OLFormGroup controlId="admin-project-scope">
                <OLFormLabel>Who can view this project</OLFormLabel>
                <Select
                  id="admin-project-scope"
                  items={SCOPE_OPTIONS}
                  itemToKey={item => item.key}
                  itemToString={item => item?.label || ''}
                  itemToSubtitle={item => item?.subtitle || ''}
                  selected={SCOPE_OPTIONS.find(o => o.key === policyScope)}
                  onSelectedItemChanged={item => {
                    if (item) setPolicyScope(item.key)
                  }}
                  disabled={savingPolicy}
                  selectedIcon
                />
              </OLFormGroup>

              <OLFormGroup controlId="admin-project-permission">
                <OLFormLabel>Permission for shared users</OLFormLabel>
                <Select
                  id="admin-project-permission"
                  items={PERMISSION_OPTIONS}
                  itemToKey={item => item.key}
                  itemToString={item => item?.label || ''}
                  itemToSubtitle={item => item?.subtitle || ''}
                  selected={PERMISSION_OPTIONS.find(o => o.key === policyMode)}
                  onSelectedItemChanged={item => {
                    if (item) setPolicyMode(item.key)
                  }}
                  disabled={savingPolicy || policyScope === 'private'}
                  selectedIcon
                />
              </OLFormGroup>
            </div>

            {policyScope === 'custom' && (
              <div className="ol-admin-custom-box mb-3">
                <div className="mb-3">
                  <OLFormLabel>Target professions / roles</OLFormLabel>
                  {allFacetRoles.length > 0 && (
                    <div className="ol-admin-facet-grid mb-2">
                      {allFacetRoles.map(r => (
                        <OLFormCheckbox
                          key={r}
                          id={`admin-policy-role-${r}`}
                          label={r}
                          checked={targetRoles.some(
                            item => item.toLowerCase() === r.toLowerCase()
                          )}
                          onChange={() =>
                            toggleFacetItem(r, targetRoles, setTargetRoles)
                          }
                          disabled={savingPolicy}
                        />
                      ))}
                    </div>
                  )}
                  <div className="d-flex gap-2">
                    <OLFormControl
                      type="text"
                      value={customRoleInput}
                      onChange={e => setCustomRoleInput(e.target.value)}
                      placeholder="Add profession / role name…"
                      disabled={savingPolicy}
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          handleAddCustomRole()
                        }
                      }}
                    />
                    <OLButton
                      variant="secondary"
                      type="button"
                      disabled={savingPolicy || !customRoleInput.trim()}
                      onClick={handleAddCustomRole}
                    >
                      Add
                    </OLButton>
                  </div>
                </div>

                <div className="mb-3">
                  <OLFormLabel>Target organizations / departments</OLFormLabel>
                  {allFacetInstitutions.length > 0 && (
                    <div className="ol-admin-facet-grid mb-2">
                      {allFacetInstitutions.map(inst => (
                        <OLFormCheckbox
                          key={inst}
                          id={`admin-policy-inst-${inst}`}
                          label={inst}
                          checked={targetInstitutions.some(
                            item => item.toLowerCase() === inst.toLowerCase()
                          )}
                          onChange={() =>
                            toggleFacetItem(
                              inst,
                              targetInstitutions,
                              setTargetInstitutions
                            )
                          }
                          disabled={savingPolicy}
                        />
                      ))}
                    </div>
                  )}
                  <div className="d-flex gap-2">
                    <OLFormControl
                      type="text"
                      value={customInstInput}
                      onChange={e => setCustomInstInput(e.target.value)}
                      placeholder="Add organization name…"
                      disabled={savingPolicy}
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          handleAddCustomInstitution()
                        }
                      }}
                    />
                    <OLButton
                      variant="secondary"
                      type="button"
                      disabled={savingPolicy || !customInstInput.trim()}
                      onClick={handleAddCustomInstitution}
                    >
                      Add
                    </OLButton>
                  </div>
                </div>

                <div>
                  <OLFormLabel>Target specific users</OLFormLabel>
                  {targetUsers.length > 0 && (
                    <div className="ol-admin-chip-list mb-2">
                      {targetUsers.map(u => (
                        <span key={u.id} className="ol-admin-chip">
                          <span>{u.fullName || u.email}</span>
                          <button
                            type="button"
                            className="ol-admin-chip-remove"
                            aria-label={`Remove ${u.email}`}
                            onClick={() =>
                              setTargetUsers(prev =>
                                prev.filter(item => item.id !== u.id)
                              )
                            }
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                  <OLFormControl
                    type="text"
                    value={targetUserSearch}
                    onChange={e => setTargetUserSearch(e.target.value)}
                    placeholder="Search user name or email to add…"
                    disabled={savingPolicy}
                  />
                  {targetUserSearch.trim() && targetUserResults.length > 0 && (
                    <div className="ol-admin-user-picker-results mt-2">
                      {targetUserResults.map(u => (
                        <button
                          key={u.id}
                          type="button"
                          className="ol-admin-user-picker-option"
                          onClick={() => {
                            setTargetUsers(prev => [
                              ...prev,
                              {
                                id: u.id,
                                email: u.email,
                                fullName: u.fullName,
                                role: u.role,
                                institution: u.institution,
                              },
                            ])
                            setTargetUserSearch('')
                          }}
                        >
                          <span className="fw-medium">
                            {u.fullName || u.email}
                          </span>
                          <span className="ol-admin-muted">{u.email}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {policyScope !== 'private' && (
              <div className="mb-3">
                <OLFormCheckbox
                  id="admin-project-network-only"
                  label="Restrict access to internal network IP / CIDR ranges only"
                  checked={
                    policyScope === 'network' ? true : policyNetworkOnly
                  }
                  disabled={savingPolicy || policyScope === 'network'}
                  onChange={e => setPolicyNetworkOnly(e.target.checked)}
                />
                {(policyScope === 'network' || policyNetworkOnly) && (
                  <OLFormGroup
                    controlId="admin-project-cidrs"
                    className="mt-2 mb-0"
                  >
                    <OLFormLabel>
                      Allowed IP / CIDR ranges (optional)
                    </OLFormLabel>
                    <OLFormControl
                      type="text"
                      value={policyCidrsText}
                      onChange={e => setPolicyCidrsText(e.target.value)}
                      placeholder="e.g. 192.168.1.0/24, 10.0.0.0/8"
                      disabled={savingPolicy}
                    />
                    <OLFormText>
                      Leave blank to allow default local/private network ranges (
                      {(facets?.defaultNetworkCidrs || []).slice(0, 4).join(', ')}
                      …).
                    </OLFormText>
                  </OLFormGroup>
                )}
              </div>
            )}

            <OLButton
              variant="primary"
              size="sm"
              type="submit"
              isLoading={savingPolicy}
              loadingLabel="Saving…"
            >
              Save workspace policy
            </OLButton>
          </OLForm>

          <hr className="ol-admin-divider" />

          <h3 className="ol-admin-subsection-title">Link sharing</h3>
          <div className="ol-admin-link-sharing-bar mb-4">
            <span className="ol-admin-status">
              <span
                className={`ol-admin-status-dot ${activeProject?.publicAccessLevel === 'tokenBased'
                  ? 'is-healthy'
                  : 'is-neutral'
                  }`}
                aria-hidden="true"
              />
              <span>
                Link sharing is currently{' '}
                <strong>
                  {activeProject?.publicAccessLevel === 'tokenBased'
                    ? 'On (anyone with the link)'
                    : 'Off'}
                </strong>
              </span>
            </span>
            <OLButton
              variant="secondary"
              size="sm"
              type="button"
              disabled={collabBusy || savingPolicy}
              onClick={handleToggleLinkSharing}
            >
              {activeProject?.publicAccessLevel === 'tokenBased'
                ? 'Turn off link sharing'
                : 'Turn on link sharing'}
            </OLButton>
          </div>

          <h3 className="ol-admin-subsection-title">
            Direct user collaborators (
            {activeProject?.collaboratorCount ?? 0})
          </h3>
          <p className="ol-admin-muted mb-3">
            Displays user-to-user shares created by the owner as well as
            individual user permissions managed here.
          </p>

          <div className="ol-admin-collab-add-row mb-3">
            <div className="ol-admin-collab-search-box">
              <OLFormControl
                type="text"
                value={
                  selectedCollabUser
                    ? `${selectedCollabUser.fullName || selectedCollabUser.email} (${selectedCollabUser.email})`
                    : collabSearch
                }
                onChange={e => {
                  setSelectedCollabUser(null)
                  setCollabSearch(e.target.value)
                }}
                placeholder="Search user name or email to grant access…"
                aria-label="Search collaborator to add"
                disabled={collabBusy}
              />
              {!selectedCollabUser &&
                collabSearch.trim() &&
                collabSearchResults.length > 0 && (
                  <div className="ol-admin-user-picker-results mt-2">
                    {collabSearchResults.map(u => (
                      <button
                        key={u.id}
                        type="button"
                        className="ol-admin-user-picker-option"
                        onClick={() => setSelectedCollabUser(u)}
                      >
                        <span className="fw-medium">
                          {u.fullName || u.email}
                        </span>
                        <span className="ol-admin-muted">{u.email}</span>
                      </button>
                    ))}
                  </div>
                )}
            </div>

            <div className="ol-admin-collab-perm-select">
              <Select
                items={PERMISSION_OPTIONS}
                itemToKey={item => item.key}
                itemToString={item => item?.label || ''}
                itemToSubtitle={item => item?.subtitle || ''}
                selected={PERMISSION_OPTIONS.find(
                  o => o.key === newCollabMode
                )}
                onSelectedItemChanged={item => {
                  if (item) setNewCollabMode(item.key)
                }}
                disabled={collabBusy}
                selectedIcon
              />
            </div>

            <OLButton
              variant="secondary"
              type="button"
              isLoading={collabBusy}
              loadingLabel="Adding…"
              disabled={!selectedCollabUser && !collabSearch.trim()}
              onClick={handleAddCollaborator}
            >
              Add user
            </OLButton>
          </div>

          {activeProject && activeProject.collaborators.length > 0 ? (
            <div className="ol-admin-collab-list">
              {activeProject.collaborators.map(c => (
                <div key={c.userId} className="ol-admin-collab-row">
                  <div className="ol-admin-collab-identity">
                    <div className="fw-medium" translate="no">
                      {c.fullName || c.email}
                    </div>
                    <div className="ol-admin-user-email" translate="no">
                      {c.email}
                      {[c.role, c.institution].filter(Boolean).length > 0
                        ? ` (${[c.role, c.institution].filter(Boolean).join(', ')})`
                        : ''}
                    </div>
                  </div>
                  <div className="ol-admin-collab-controls">
                    <Select
                      size="sm"
                      items={PERMISSION_OPTIONS}
                      itemToKey={item => item.key}
                      itemToString={item => item?.label || ''}
                      itemToSubtitle={item => item?.subtitle || ''}
                      selected={PERMISSION_OPTIONS.find(
                        o => o.key === c.permissionMode
                      )}
                      onSelectedItemChanged={item => {
                        if (item && item.key !== c.permissionMode) {
                          handleUpdateCollaborator(c.userId, item.key)
                        }
                      }}
                      disabled={collabBusy}
                      selectedIcon
                    />
                    <OLButton
                      variant="danger-ghost"
                      size="sm"
                      type="button"
                      disabled={collabBusy}
                      onClick={() => handleRemoveCollaborator(c.userId)}
                    >
                      Remove
                    </OLButton>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="ol-admin-empty-box">
              No direct user-to-user collaborators on this project.
            </div>
          )}
        </OLModalBody>
        <OLModalFooter>
          <OLButton
            variant="secondary"
            type="button"
            disabled={savingPolicy || collabBusy}
            onClick={() => setActiveProject(null)}
          >
            Close
          </OLButton>
        </OLModalFooter>
      </OLModal>
    </>
  )
}
