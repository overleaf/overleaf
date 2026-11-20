import {
  FetchError,
  deleteJSON,
  getJSON,
  postJSON,
} from '@/infrastructure/fetch-json'
import getMeta from '@/utils/meta'

export type ServiceHealth = {
  ok: boolean
  latencyMs?: number
  statusCode?: number
  error?: string
  data?: {
    ok?: boolean
    installedCount?: number
    availableCount?: number
    allowedRoot?: string
    defaultBaseDir?: string
  }
}

export type AdminSystemMessage = {
  id: string
  content: string
}

export type EnterpriseScope = 'private' | 'network' | 'all_users' | 'custom'
export type PermissionMode = 'edit' | 'copy' | 'view_only'

export type AdminMiniUser = {
  id: string
  email: string
  fullName: string
  role: string
  institution: string
}

export type AdminProjectCollaborator = {
  userId: string
  email: string
  fullName: string
  role: string
  institution: string
  permissionMode: PermissionMode
  allowCopy: boolean
}

export type AdminProjectRecord = {
  id: string
  name: string
  lastUpdated: string | null
  publicAccessLevel?: string
  owner: AdminMiniUser | null
  enterpriseAccess: {
    scope: EnterpriseScope
    permissionMode: PermissionMode
    allowCopy: boolean
    networkOnly: boolean
    allowedCidrs: string[]
    targetRoles: string[]
    targetInstitutions: string[]
    targetUsers: AdminMiniUser[]
    updatedAt: string | null
  }
  collaborators: AdminProjectCollaborator[]
  collaboratorCount: number
  sharingKind: 'enterprise' | 'user_shared' | 'both' | 'private'
}

export type AdminProjectsResponse = {
  projects: AdminProjectRecord[]
  total: number
  page: number
  limit: number
  totalPages: number
  facets: {
    roles: string[]
    institutions: string[]
    defaultNetworkCidrs: string[]
    counts: {
      totalProjects: number
      enterpriseShared: number
      userShared: number
      privateProjects: number
    }
  }
}

export type AdminOverview = {
  editor: {
    isOpen: boolean
  }
  services: {
    mongodb: ServiceHealth
    redis: ServiceHealth
    localSync: ServiceHealth
    packageHub: ServiceHealth
  }
  counts: {
    totalUsers: number
    adminUsers: number
    suspendedUsers: number
    totalProjects: number
    enterpriseSharedProjects: number
    userSharedProjects: number
  }
  runtime: {
    appName: string
    env: string
    nodeVersion: string
    platform: string
    arch: string
    uptimeSeconds: number
    smtpConfigured: boolean
    packageHubEnabled: boolean
  }
  systemMessages: AdminSystemMessage[]
}

export type AdminUser = {
  id: string
  email: string
  first_name: string
  last_name: string
  fullName: string
  role: string
  institution: string
  isAdmin: boolean
  suspended: boolean
  loginCount: number
  signUpDate: string | null
  lastLoggedIn: string | null
  lastActive: string | null
  projectCount: number
}

export type AdminUsersResponse = {
  users: AdminUser[]
  total: number
  page: number
  limit: number
  totalPages: number
}

async function requestWithMethod<T = any>(
  method: 'PATCH' | 'PUT',
  url: string,
  body: Record<string, unknown>
): Promise<T> {
  const options: RequestInit = {
    method,
    credentials: 'same-origin',
    headers: {
      'Content-Type': 'application/json',
      'X-Csrf-Token': getMeta('ol-csrfToken'),
      Accept: 'application/json',
    },
    body: JSON.stringify(body),
  }

  const response = await fetch(url, options)
  const text = await response.text()
  let data: any = null
  if (text) {
    try {
      data = JSON.parse(text)
    } catch {
      data = text
    }
  }
  if (!response.ok) {
    throw new FetchError(response.statusText, url, options, response, data)
  }
  return data as T
}

export function getAdminOverview(): Promise<AdminOverview> {
  return getJSON('/api/admin/overview')
}

export function setEditorStatus(
  isOpen: boolean
): Promise<{ ok: boolean; isOpen: boolean }> {
  return postJSON('/api/admin/editor', { body: { isOpen } })
}

export function disconnectAllUsers(
  delaySeconds = 10
): Promise<{ ok: boolean; delay: number }> {
  return postJSON('/api/admin/disconnect-all', {
    body: { delay: delaySeconds },
  })
}

export function createSystemMessage(
  content: string
): Promise<{ ok: boolean; systemMessages: AdminSystemMessage[] }> {
  return postJSON('/api/admin/messages', { body: { content } })
}

export function deleteSystemMessage(
  messageId: string
): Promise<{ ok: boolean; systemMessages: AdminSystemMessage[] }> {
  return deleteJSON(`/api/admin/messages/${encodeURIComponent(messageId)}`)
}

export function clearSystemMessages(): Promise<{
  ok: boolean
  systemMessages: AdminSystemMessage[]
}> {
  return postJSON('/api/admin/messages/clear')
}

export function listAdminUsers(params: {
  search?: string
  filter?: 'all' | 'admins' | 'active' | 'suspended'
  page?: number
  limit?: number
}): Promise<AdminUsersResponse> {
  const qs = new URLSearchParams()
  if (params.search) qs.set('search', params.search)
  if (params.filter) qs.set('filter', params.filter)
  if (params.page) qs.set('page', String(params.page))
  if (params.limit) qs.set('limit', String(params.limit))
  return getJSON(`/api/admin/users?${qs.toString()}`)
}

export function createAdminUser(body: {
  email: string
  password?: string
  fullName?: string
  role?: string
  institution?: string
  isAdmin?: boolean
}): Promise<{
  ok: boolean
  user: AdminUser
  activationUrl: string | null
}> {
  return postJSON('/api/admin/users', { body })
}

export function updateAdminUser(
  userId: string,
  body: {
    first_name?: string
    last_name?: string
    role?: string
    institution?: string
    password?: string
    isAdmin?: boolean
    suspended?: boolean
  }
): Promise<{ ok: boolean; user: AdminUser }> {
  return requestWithMethod(
    'PATCH',
    `/api/admin/users/${encodeURIComponent(userId)}`,
    body
  )
}

export function generateUserResetLink(userId: string): Promise<{
  ok: boolean
  email: string
  resetUrl: string
}> {
  return postJSON(
    `/api/admin/users/${encodeURIComponent(userId)}/reset-link`
  )
}

export function deleteAdminUser(userId: string): Promise<{ ok: boolean }> {
  return deleteJSON(`/api/admin/users/${encodeURIComponent(userId)}`)
}

export function listAdminProjects(params: {
  search?: string
  filter?: 'all' | 'enterprise' | 'user_shared' | 'private'
  page?: number
  limit?: number
}): Promise<AdminProjectsResponse> {
  const qs = new URLSearchParams()
  if (params.search) qs.set('search', params.search)
  if (params.filter) qs.set('filter', params.filter)
  if (params.page) qs.set('page', String(params.page))
  if (params.limit) qs.set('limit', String(params.limit))
  return getJSON(`/api/admin/projects?${qs.toString()}`)
}

export function updateAdminProjectAccess(
  projectId: string,
  body: {
    scope: EnterpriseScope
    permissionMode: PermissionMode
    networkOnly?: boolean
    allowedCidrs?: string[]
    targetRoles?: string[]
    targetInstitutions?: string[]
    targetUserIds?: string[]
  }
): Promise<{ ok: boolean; project: AdminProjectRecord }> {
  return requestWithMethod(
    'PUT',
    `/api/admin/projects/${encodeURIComponent(projectId)}/access`,
    body
  )
}

export function addAdminProjectCollaborator(
  projectId: string,
  body: {
    userId?: string
    email?: string
    permissionMode: PermissionMode
  }
): Promise<{ ok: boolean; project: AdminProjectRecord }> {
  return postJSON(
    `/api/admin/projects/${encodeURIComponent(projectId)}/collaborators`,
    { body }
  )
}

export function updateAdminProjectCollaborator(
  projectId: string,
  userId: string,
  permissionMode: PermissionMode
): Promise<{ ok: boolean; project: AdminProjectRecord }> {
  return requestWithMethod(
    'PATCH',
    `/api/admin/projects/${encodeURIComponent(projectId)}/collaborators/${encodeURIComponent(userId)}`,
    { permissionMode }
  )
}

export function removeAdminProjectCollaborator(
  projectId: string,
  userId: string
): Promise<{ ok: boolean; project: AdminProjectRecord }> {
  return deleteJSON(
    `/api/admin/projects/${encodeURIComponent(projectId)}/collaborators/${encodeURIComponent(userId)}`
  )
}

export function toggleAdminProjectLinkSharing(
  projectId: string,
  publicAccessLevel: 'tokenBased' | 'private'
): Promise<void> {
  return postJSON(`/project/${encodeURIComponent(projectId)}/settings/admin`, {
    body: { publicAccessLevel },
  })
}

export type AdminBranding = {
  hasCustomLogo: boolean
  logoUrl: string | null
  hasCustomLogoDark: boolean
  logoDarkUrl: string | null
  organizationName: string
  version: string
  updatedAt: string | null
}

export function getAdminBranding(): Promise<{
  ok: boolean
  branding: AdminBranding
}> {
  return getJSON('/api/admin/branding')
}

export function updateAdminBranding(body: {
  organizationName?: string
  logoDataUrl?: string
  logoDarkDataUrl?: string
  clearLogo?: boolean
  clearLogoDark?: boolean
}): Promise<{ ok: boolean; branding: AdminBranding }> {
  return requestWithMethod('PUT', '/api/admin/branding', body)
}

export function resetAdminBranding(): Promise<{
  ok: boolean
  branding: AdminBranding
}> {
  return deleteJSON('/api/admin/branding')
}
