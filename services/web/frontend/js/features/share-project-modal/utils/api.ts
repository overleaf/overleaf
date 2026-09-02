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
  privileges: PermissionsLevel
) {
  return [
    `/project/${projectId}/invite`,
    {
      body: {
        email, // TODO: normalisedEmail?
        privileges,
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
  data: { privilegeLevel: PermissionsLevel }
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
