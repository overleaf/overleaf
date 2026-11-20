import {
  ProjectMember,
  RequestedPrivilegeLevel,
} from '@/shared/context/types/project-metadata'
import {
  deleteJSON,
  getJSON,
  postJSON,
  putJSON,
} from '../../../infrastructure/fetch-json'
import { PermissionsLevel } from '@/features/ide-react/types/permissions'
import { useFetchWithRecaptcha } from '@/shared/hooks/fetch-with-recaptcha/fetch-with-recaptcha'

export type SharingLinkPrivileges =
  | 'readAndWrite'
  | 'review'
  | 'readOnly'
  | false

export type SharingLinkData = {
  _id: string
  token: string
  privileges: SharingLinkPrivileges
  subscriptionId?: string
}

export function getSharingLink(projectId: string) {
  return getJSON<SharingLinkData>(`/project/${projectId}/sharing-link`)
}

export function updateSharingLink(
  projectId: string,
  data: Pick<SharingLinkData, 'privileges' | 'subscriptionId'>
) {
  return postJSON<SharingLinkData>(`/project/${projectId}/sharing-link`, {
    body: data,
  })
}

export function sendInviteParams(
  projectId: string,
  email: string,
  privileges: PermissionsLevel,
  allowCopy?: boolean
) {
  return [
    `/project/${projectId}/invite`,
    {
      body: {
        email, // TODO: normalisedEmail?
        privileges,
        ...(allowCopy !== undefined ? { allowCopy } : {}),
      },
    },
  ] as const
}

export function useSendInvite() {
  return useFetchWithRecaptcha(postJSON, { action: 'invite' })
}

export function resendInvite(projectId: string, invite: ProjectMember) {
  return postJSON(`/project/${projectId}/invite/${invite._id}/resend`)
}

export function revokeInvite(projectId: string, invite: ProjectMember) {
  return deleteJSON(`/project/${projectId}/invite/${invite._id}`)
}

export function updateMember(
  projectId: string,
  member: ProjectMember,
  data: { privilegeLevel: PermissionsLevel; allowCopy?: boolean }
) {
  return putJSON(`/project/${projectId}/users/${member._id}`, {
    body: data,
  })
}

export function removeMemberFromProject(
  projectId: string,
  member: ProjectMember
) {
  return deleteJSON(`/project/${projectId}/users/${member._id}`)
}

export function requestAccess(
  projectId: string,
  privilegeLevel: RequestedPrivilegeLevel
) {
  return postJSON(`/project/${projectId}/request-access`, {
    body: { privilegeLevel },
  })
}

export function declineAccessRequest(
  projectId: string,
  userId: string,
  notify: boolean
) {
  return deleteJSON(`/project/${projectId}/access-requests/${userId}`, {
    body: { notify },
  })
}

export function grantAccessRequest(
  projectId: string,
  userId: string,
  privilegeLevel: RequestedPrivilegeLevel,
  notify: boolean
) {
  return postJSON(`/project/${projectId}/access-requests/${userId}/grant`, {
    body: { privilegeLevel, notify },
  })
}

export function transferProjectOwnership(
  projectId: string,
  member: ProjectMember
) {
  return postJSON(`/project/${projectId}/transfer-ownership`, {
    body: {
      user_id: member._id,
    },
  })
}

export function setPublicAccessLevel(
  projectId: string,
  publicAccessLevel: string
) {
  return postJSON(`/project/${projectId}/settings/admin`, {
    body: { publicAccessLevel },
  })
}

export function listProjectMembers(projectId: string) {
  return getJSON(`/project/${projectId}/members`)
}

export function listProjectAccessRequests(projectId: string) {
  return getJSON(`/project/${projectId}/access-requests`)
}

export function listProjectInvites(projectId: string) {
  return getJSON(`/project/${projectId}/invites`)
}

export type AdminEnterpriseScope = 'private' | 'network' | 'all_users' | 'custom'
export type AdminEnterprisePermissionMode = 'edit' | 'copy' | 'view_only'

export type AdminEnterpriseMiniUser = {
  id: string
  email: string
  fullName: string
  role: string
  institution: string
}

export type AdminProjectAccessDetailsResponse = {
  project: {
    id: string
    name: string
    enterpriseAccess: {
      scope: AdminEnterpriseScope
      permissionMode: AdminEnterprisePermissionMode
      allowCopy: boolean
      networkOnly: boolean
      allowedCidrs: string[]
      targetRoles: string[]
      targetInstitutions: string[]
      targetUsers: AdminEnterpriseMiniUser[]
      updatedAt: string | null
    }
  }
  facets: {
    roles: string[]
    institutions: string[]
    defaultNetworkCidrs: string[]
  }
}

export type AdminEnterpriseAccessPayload = {
  scope: AdminEnterpriseScope
  permissionMode: AdminEnterprisePermissionMode
  networkOnly?: boolean
  allowedCidrs?: string[]
  targetRoles?: string[]
  targetInstitutions?: string[]
  targetUserIds?: string[]
}

export function getAdminProjectEnterpriseAccess(projectId: string) {
  return getJSON<AdminProjectAccessDetailsResponse>(
    `/api/admin/projects/${encodeURIComponent(projectId)}/access`
  )
}

export function updateAdminProjectEnterpriseAccess(
  projectId: string,
  payload: AdminEnterpriseAccessPayload
) {
  return putJSON<{ ok: boolean; project: AdminProjectAccessDetailsResponse['project'] }>(
    `/api/admin/projects/${encodeURIComponent(projectId)}/access`,
    { body: payload }
  )
}

export function searchAdminWorkspaceUsers(search: string) {
  const qs = new URLSearchParams({
    search,
    filter: 'active',
    page: '1',
    limit: '8',
  })
  return getJSON<{ users: AdminEnterpriseMiniUser[] }>(
    `/api/admin/users?${qs.toString()}`
  )
}
