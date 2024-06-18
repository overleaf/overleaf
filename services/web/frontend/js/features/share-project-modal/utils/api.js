import {
  deleteJSON,
  getJSON,
  postJSON,
  putJSON,
} from '../../../infrastructure/fetch-json'
import { executeV2Captcha } from './captcha'
import getMeta from '@/utils/meta'

export function sendInvite(projectId, email, privileges) {
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

export function resendInvite(projectId, invite) {
  return postJSON(`/project/${projectId}/invite/${invite._id}/resend`)
}

export function revokeInvite(projectId, invite) {
  return deleteJSON(`/project/${projectId}/invite/${invite._id}`)
}

export function updateMember(projectId, member, data) {
  return putJSON(`/project/${projectId}/users/${member._id}`, {
    body: data,
  })
}

export function removeMemberFromProject(projectId, member) {
  return deleteJSON(`/project/${projectId}/users/${member._id}`)
}

export function transferProjectOwnership(projectId, member) {
  return postJSON(`/project/${projectId}/transfer-ownership`, {
    body: {
      user_id: member._id,
    },
  })
}

export function setProjectAccessLevel(projectId, publicAccessLevel) {
  return postJSON(`/project/${projectId}/settings/admin`, {
    body: { publicAccessLevel },
  })
}

export function listProjectMembers(projectId) {
  return getJSON(`/project/${projectId}/members`)
}

export function listProjectInvites(projectId) {
  return getJSON(`/project/${projectId}/invites`)
}
