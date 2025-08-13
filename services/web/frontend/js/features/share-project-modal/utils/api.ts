import { ProjectMember } from '@/shared/context/types/project-metadata'
import {
  deleteJSON,
  getJSON,
  postJSON,
  putJSON,
} from '../../../infrastructure/fetch-json'
import { executeV2Captcha } from './captcha'
import getMeta from '@/utils/meta'
import { PermissionsLevel } from '@/features/ide-react/types/permissions'

export function sendInvite(
  projectId: string,
  email: string,
  privileges: PermissionsLevel
) {
  return executeV2Captcha(
    getMeta('ol-ExposedSettings').recaptchaDisabled?.invite
  ).then(grecaptchaResponse => {
    return postJSON(`/project/${projectId}/invite`, {
      body: {
        email, // TODO: normalisedEmail?
        privileges,
        'g-recaptcha-response': grecaptchaResponse,
      },
    })
  })
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

export function listProjectInvites(projectId: string) {
  return getJSON(`/project/${projectId}/invites`)
}
