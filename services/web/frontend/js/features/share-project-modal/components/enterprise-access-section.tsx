import { useCallback, useEffect, useMemo, useState } from 'react'
import { Select } from '@/shared/components/select'
import MaterialIcon from '@/shared/components/material-icon'
import Notification from '@/shared/components/notification'
import OLButton from '@/shared/components/ol/ol-button'
import OLFormCheckbox from '@/shared/components/ol/ol-form-checkbox'
import OLFormControl from '@/shared/components/ol/ol-form-control'
import OLFormLabel from '@/shared/components/ol/ol-form-label'
import OLSpinner from '@/shared/components/ol/ol-spinner'
import OLTag from '@/shared/components/ol/ol-tag'
import { OLDropdownItem } from '@/shared/components/ol/ol-dropdown-menu'
import { getUserFacingMessage } from '@/infrastructure/fetch-json'
import { useProjectContext } from '@/shared/context/project-context'
import { useUserContext } from '@/shared/context/user-context'
import { useShareProjectContext } from './share-project-modal'
import {
  AdminEnterpriseMiniUser,
  AdminEnterprisePermissionMode,
  AdminEnterpriseScope,
  getAdminProjectEnterpriseAccess,
  searchAdminWorkspaceUsers,
  updateAdminProjectEnterpriseAccess,
} from '../utils/api'

type ScopeOption = {
  key: AdminEnterpriseScope
  label: string
  description: string
}

type PermissionOption = {
  key: AdminEnterprisePermissionMode
  label: string
  description: string
}

const SCOPE_OPTIONS: ScopeOption[] = [
  {
    key: 'private',
    label: 'Private (collaborators only)',
    description: 'Only owner, direct collaborators, and link-share guests',
  },
  {
    key: 'network',
    label: 'Internal network only',
    description: 'Users connected from trusted LAN / VPN ranges',
  },
  {
    key: 'all_users',
    label: 'All workspace users',
    description: 'Every active signed-in account in this workspace',
  },
  {
    key: 'custom',
    label: 'Custom audience',
    description: 'Target by profession, organization, or specific users',
  },
]

const PERMISSION_OPTIONS: PermissionOption[] = [
  {
    key: 'copy',
    label: 'Viewer (can copy)',
    description: 'View & use as a copy',
  },
  {
    key: 'edit',
    label: 'Editor',
    description: 'Modify original project',
  },
  {
    key: 'view_only',
    label: 'Viewer (no copy)',
    description: 'View only, copying disabled',
  },
]

function formatNoticeScope(scope?: AdminEnterpriseScope, networkOnly?: boolean) {
  if (scope === 'network') return 'Internal network users (LAN / VPN)'
  if (scope === 'all_users') {
    return networkOnly
      ? 'All workspace users on trusted network'
      : 'All workspace users'
  }
  if (scope === 'custom') {
    return networkOnly
      ? 'Selected workspace audience (LAN only)'
      : 'Selected workspace audience'
  }
  return 'Private'
}

function formatNoticePermission(mode?: AdminEnterprisePermissionMode | null) {
  if (mode === 'edit') return 'Editor (modify original)'
  if (mode === 'view_only') return 'Viewer (no copy)'
  return 'Viewer (can copy)'
}

export default function EnterpriseAccessSection() {
  const { projectId, project, updateProject } = useProjectContext()
  const user = useUserContext()
  const { setSuccessActionMessage } = useShareProjectContext()

  const isSiteAdmin = Boolean((user as any)?.isAdmin)
  const summary = project?.enterpriseAccess

  const [loadingDetails, setLoadingDetails] = useState(false)
  const [loadedProjectId, setLoadedProjectId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)
  const [localSaved, setLocalSaved] = useState<string | null>(null)
  const [expanded, setExpanded] = useState(false)

  const [scope, setScope] = useState<AdminEnterpriseScope>(
    summary?.scope || 'private'
  )
  const [permissionMode, setPermissionMode] =
    useState<AdminEnterprisePermissionMode>(summary?.permissionMode || 'copy')
  const [networkOnly, setNetworkOnly] = useState(Boolean(summary?.networkOnly))
  const [cidrsText, setCidrsText] = useState('')
  const [defaultCidrs, setDefaultCidrs] = useState<string[]>([])
  const [facetRoles, setFacetRoles] = useState<string[]>([])
  const [facetInstitutions, setFacetInstitutions] = useState<string[]>([])
  const [targetRoles, setTargetRoles] = useState<string[]>([])
  const [targetInstitutions, setTargetInstitutions] = useState<string[]>([])
  const [targetUsers, setTargetUsers] = useState<AdminEnterpriseMiniUser[]>([])
  const [customRoleInput, setCustomRoleInput] = useState('')
  const [customInstInput, setCustomInstInput] = useState('')
  const [userSearchQuery, setUserSearchQuery] = useState('')
  const [userSearchResults, setUserSearchResults] = useState<
    AdminEnterpriseMiniUser[]
  >([])

  useEffect(() => {
    if (!isSiteAdmin || !projectId || loadedProjectId === projectId) {
      return
    }
    let cancelled = false
    setLoadingDetails(true)
    setLocalError(null)

    getAdminProjectEnterpriseAccess(projectId)
      .then(res => {
        if (cancelled) return
        const ea = res.project.enterpriseAccess
        setScope(ea.scope)
        setPermissionMode(ea.permissionMode || 'copy')
        setNetworkOnly(ea.scope === 'network' || ea.networkOnly)
        setCidrsText((ea.allowedCidrs || []).join(', '))
        setTargetRoles(ea.targetRoles || [])
        setTargetInstitutions(ea.targetInstitutions || [])
        setTargetUsers(ea.targetUsers || [])
        setFacetRoles(res.facets.roles || [])
        setFacetInstitutions(res.facets.institutions || [])
        setDefaultCidrs(res.facets.defaultNetworkCidrs || [])
        setLoadedProjectId(projectId)
      })
      .catch(err => {
        if (!cancelled) {
          setLocalError(
            String(
              getUserFacingMessage(err as Error) ||
                'Failed to load workspace access settings'
            )
          )
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingDetails(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [isSiteAdmin, loadedProjectId, projectId])

  useEffect(() => {
    if (!isSiteAdmin || scope !== 'custom') {
      setUserSearchResults([])
      return
    }
    const q = userSearchQuery.trim()
    if (!q) {
      setUserSearchResults([])
      return
    }
    const timer = window.setTimeout(async () => {
      try {
        const res = await searchAdminWorkspaceUsers(q)
        const chosen = new Set(targetUsers.map(u => u.id))
        const ownerId = project?.owner?._id ? String(project.owner._id) : ''
        setUserSearchResults(
          (res.users || []).filter(u => u.id !== ownerId && !chosen.has(u.id))
        )
      } catch {
        setUserSearchResults([])
      }
    }, 200)

    return () => {
      window.clearTimeout(timer)
    }
  }, [isSiteAdmin, project?.owner?._id, scope, targetUsers, userSearchQuery])

  const allRoles = useMemo(() => {
    const merged = new Set<string>(facetRoles)
    for (const r of targetRoles) merged.add(r)
    return Array.from(merged).sort((a, b) => a.localeCompare(b))
  }, [facetRoles, targetRoles])

  const allInstitutions = useMemo(() => {
    const merged = new Set<string>(facetInstitutions)
    for (const inst of targetInstitutions) merged.add(inst)
    return Array.from(merged).sort((a, b) => a.localeCompare(b))
  }, [facetInstitutions, targetInstitutions])

  const toggleItem = useCallback(
    (
      item: string,
      list: string[],
      setter: React.Dispatch<React.SetStateAction<string[]>>
    ) => {
      const lower = item.toLowerCase()
      if (list.some(v => v.toLowerCase() === lower)) {
        setter(list.filter(v => v.toLowerCase() !== lower))
      } else {
        setter([...list, item])
      }
    },
    []
  )

  const handleAddRole = useCallback(() => {
    const val = customRoleInput.trim()
    if (!val) return
    if (!targetRoles.some(r => r.toLowerCase() === val.toLowerCase())) {
      setTargetRoles(prev => [...prev, val])
    }
    setCustomRoleInput('')
  }, [customRoleInput, targetRoles])

  const handleAddInstitution = useCallback(() => {
    const val = customInstInput.trim()
    if (!val) return
    if (!targetInstitutions.some(i => i.toLowerCase() === val.toLowerCase())) {
      setTargetInstitutions(prev => [...prev, val])
    }
    setCustomInstInput('')
  }, [customInstInput, targetInstitutions])

  const handleSave = useCallback(async () => {
    setSaving(true)
    setLocalError(null)
    setLocalSaved(null)
    const parsedCidrs = cidrsText
      .split(/[\s,]+/)
      .map(s => s.trim())
      .filter(Boolean)

    try {
      const res = await updateAdminProjectEnterpriseAccess(projectId, {
        scope,
        permissionMode,
        networkOnly: scope === 'network' ? true : networkOnly,
        allowedCidrs: parsedCidrs,
        targetRoles,
        targetInstitutions,
        targetUserIds: targetUsers.map(u => u.id),
      })
      const ea = res.project.enterpriseAccess
      updateProject({
        enterpriseAccess: {
          scope: ea.scope,
          permissionMode: ea.scope === 'private' ? null : ea.permissionMode,
          networkOnly: ea.networkOnly,
        },
      })
      setLocalSaved('Workspace access settings saved.')
      setSuccessActionMessage('Workspace access updated')
    } catch (err) {
      setLocalError(
        String(getUserFacingMessage(err as Error) || 'Failed to save workspace access')
      )
    } finally {
      setSaving(false)
    }
  }, [
    cidrsText,
    networkOnly,
    permissionMode,
    projectId,
    scope,
    setSuccessActionMessage,
    targetInstitutions,
    targetRoles,
    targetUsers,
    updateProject,
  ])

  if (!isSiteAdmin) {
    if (!summary || summary.scope === 'private') {
      return null
    }
    return (
      <div className="enterprise-access-notice">
        <MaterialIcon type="domain" unfilled />
        <div>
          <div>
            <strong>Workspace access:</strong>{' '}
            {formatNoticeScope(summary.scope, summary.networkOnly)},{' '}
            {formatNoticePermission(summary.permissionMode)}
          </div>
          <div className="enterprise-access-notice-meta">
            Configured at the workspace level by System Admin.
          </div>
        </div>
      </div>
    )
  }

  const showDetailsPanel =
    scope !== 'private' && (scope === 'custom' || expanded)

  return (
    <div className="enterprise-access-section">
      <div className="enterprise-access-header">
        <div className="enterprise-access-title">
          <MaterialIcon
            type={scope === 'private' ? 'lock' : 'domain'}
            unfilled
          />
          <strong>Workspace &amp; network access</strong>
          {loadingDetails && <OLSpinner size="sm" />}
        </div>

        {scope !== 'private' && scope !== 'custom' && (
          <OLButton
            variant="link"
            size="sm"
            type="button"
            className="btn-inline-link p-0"
            onClick={() => setExpanded(prev => !prev)}
          >
            {expanded ? 'Hide network rules' : 'Network rules'}
          </OLButton>
        )}
      </div>

      <div className="enterprise-access-controls">
        <Select
          dataTestId="enterprise-scope-select"
          items={SCOPE_OPTIONS}
          itemToKey={item => item.key}
          itemToString={item => item?.label || ''}
          itemToSubtitle={item => item?.description || ''}
          selected={SCOPE_OPTIONS.find(o => o.key === scope)}
          onSelectedItemChanged={item => {
            if (item) {
              setScope(item.key)
              if (item.key === 'network') {
                setNetworkOnly(true)
              } else if (item.key === 'private') {
                setNetworkOnly(false)
              }
            }
          }}
          selectedIcon
        />

        <Select
          dataTestId="enterprise-permission-select"
          items={PERMISSION_OPTIONS}
          itemToKey={item => item.key}
          itemToString={item => item?.label || ''}
          itemToSubtitle={item => item?.description || ''}
          disabled={scope === 'private'}
          selected={PERMISSION_OPTIONS.find(o => o.key === permissionMode)}
          onSelectedItemChanged={item => {
            if (item) {
              setPermissionMode(item.key)
            }
          }}
          selectedIcon
        />

        <OLButton
          variant="primary"
          size="sm"
          type="button"
          onClick={handleSave}
          disabled={loadingDetails || saving}
          isLoading={saving}
        >
          Save
        </OLButton>
      </div>

      {localError && (
        <div className="notification-list mt-2">
          <Notification type="error" content={localError} className="mb-0" />
        </div>
      )}
      {localSaved && !localError && (
        <div className="notification-list mt-2">
          <Notification type="success" content={localSaved} className="mb-0" />
        </div>
      )}

      {showDetailsPanel && (
        <div className="enterprise-access-details">
          {scope === 'custom' && (
            <>
              <div className="mb-3">
                <OLFormLabel className="small fw-semibold mb-1">
                  Target professions / roles
                </OLFormLabel>
                {allRoles.length > 0 && (
                  <div className="enterprise-access-facet-grid">
                    {allRoles.map(role => (
                      <OLFormCheckbox
                        key={role}
                        id={`modal-role-${role}`}
                        label={role}
                        checked={targetRoles.some(
                          r => r.toLowerCase() === role.toLowerCase()
                        )}
                        onChange={() =>
                          toggleItem(role, targetRoles, setTargetRoles)
                        }
                        disabled={saving}
                      />
                    ))}
                  </div>
                )}
                <div className="d-flex gap-2">
                  <OLFormControl
                    type="text"
                    size="sm"
                    value={customRoleInput}
                    onChange={e => setCustomRoleInput(e.target.value)}
                    placeholder="Add profession / role…"
                    disabled={saving}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        handleAddRole()
                      }
                    }}
                  />
                  <OLButton
                    variant="secondary"
                    size="sm"
                    type="button"
                    disabled={saving || !customRoleInput.trim()}
                    onClick={handleAddRole}
                  >
                    Add
                  </OLButton>
                </div>
              </div>

              <div className="mb-3">
                <OLFormLabel className="small fw-semibold mb-1">
                  Target organizations / departments
                </OLFormLabel>
                {allInstitutions.length > 0 && (
                  <div className="enterprise-access-facet-grid">
                    {allInstitutions.map(inst => (
                      <OLFormCheckbox
                        key={inst}
                        id={`modal-inst-${inst}`}
                        label={inst}
                        checked={targetInstitutions.some(
                          v => v.toLowerCase() === inst.toLowerCase()
                        )}
                        onChange={() =>
                          toggleItem(
                            inst,
                            targetInstitutions,
                            setTargetInstitutions
                          )
                        }
                        disabled={saving}
                      />
                    ))}
                  </div>
                )}
                <div className="d-flex gap-2">
                  <OLFormControl
                    type="text"
                    size="sm"
                    value={customInstInput}
                    onChange={e => setCustomInstInput(e.target.value)}
                    placeholder="Add organization / department…"
                    disabled={saving}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        handleAddInstitution()
                      }
                    }}
                  />
                  <OLButton
                    variant="secondary"
                    size="sm"
                    type="button"
                    disabled={saving || !customInstInput.trim()}
                    onClick={handleAddInstitution}
                  >
                    Add
                  </OLButton>
                </div>
              </div>

              <div className="mb-3">
                <OLFormLabel
                  className="small fw-semibold mb-1"
                  htmlFor="enterprise-custom-user-search"
                >
                  Specific users (optional)
                </OLFormLabel>
                <OLFormControl
                  id="enterprise-custom-user-search"
                  type="text"
                  size="sm"
                  value={userSearchQuery}
                  onChange={e => setUserSearchQuery(e.target.value)}
                  placeholder="Search user name or email…"
                  disabled={saving}
                />
                {userSearchResults.length > 0 && (
                  <ul className="enterprise-access-user-results">
                    {userSearchResults.map(u => (
                      <li key={u.id}>
                        <OLDropdownItem
                          as="button"
                          type="button"
                          onClick={() => {
                            setTargetUsers(prev =>
                              prev.some(item => item.id === u.id)
                                ? prev
                                : [...prev, u]
                            )
                            setUserSearchQuery('')
                            setUserSearchResults([])
                          }}
                        >
                          {u.fullName ? `${u.fullName} (${u.email})` : u.email}
                        </OLDropdownItem>
                      </li>
                    ))}
                  </ul>
                )}
                {targetUsers.length > 0 && (
                  <div className="enterprise-access-chips">
                    {targetUsers.map(u => (
                      <OLTag
                        key={u.id}
                        closeBtnProps={{
                          onClick: () =>
                            setTargetUsers(prev =>
                              prev.filter(item => item.id !== u.id)
                            ),
                        }}
                      >
                        {u.fullName ? `${u.fullName} <${u.email}>` : u.email}
                      </OLTag>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

          <div>
            <OLFormCheckbox
              id="enterprise-network-only-check"
              label="Restrict access to internal network / CIDR ranges"
              checked={scope === 'network' || networkOnly}
              disabled={saving || scope === 'network'}
              onChange={e => setNetworkOnly(e.target.checked)}
            />
            {(scope === 'network' || networkOnly) && (
              <div className="mt-2">
                <OLFormControl
                  type="text"
                  size="sm"
                  value={cidrsText}
                  onChange={e => setCidrsText(e.target.value)}
                  placeholder="Optional CIDR ranges (comma-separated, e.g. 192.168.1.0/24, 10.0.0.0/8)"
                  disabled={saving}
                />
                <div className="enterprise-access-subtitle">
                  Leave empty to allow default private LAN / VPN ranges (
                  {defaultCidrs.length > 0
                    ? `${defaultCidrs.slice(0, 4).join(', ')}…`
                    : 'RFC1918 / localhost / ULA'}
                  ).
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
