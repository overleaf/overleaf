import {
  deleteJSON,
  getJSON,
  postJSON,
  putJSON
} from '../../../infrastructure/fetch-json'
import { executeV2Captcha } from './captcha'

export function sendInvite(project, email, privileges) {
  return executeV2Captcha(
    window.ExposedSettings.recaptchaDisabled?.invite
  ).then(grecaptchaResponse => {
    return postJSON(`/project/${project._id}/invite`, {
      body: {
        email, // TODO: normalisedEmail?
        privileges,
        'g-recaptcha-response': grecaptchaResponse
      }
    })
  })
}

export function resendInvite(project, invite) {
  return postJSON(`/project/${project._id}/invite/${invite._id}/resend`)
}

export function revokeInvite(project, invite) {
  return deleteJSON(`/project/${project._id}/invite/${invite._id}`)
}

export function updateMember(project, member, data) {
  return putJSON(`/project/${project._id}/users/${member._id}`, {
    body: data
  })
}

export function removeMemberFromProject(project, member) {
  return deleteJSON(`/project/${project._id}/users/${member._id}`)
}

export function transferProjectOwnership(project, member) {
  return postJSON(`/project/${project._id}/transfer-ownership`, {
    body: {
      user_id: member._id
    }
  })
}

export function setProjectAccessLevel(project, publicAccessLevel) {
  return postJSON(`/project/${project._id}/settings/admin`, {
    body: { publicAccessLevel }
  })
}

// export function updateProjectAdminSettings(project, data) {
//   return postJSON(`/project/${project._id}/settings/admin`, {
//     body: data
//   })
// }

export function listProjectMembers(project) {
  return getJSON(`/project/${project._id}/members`)
}

export function listProjectInvites(project) {
  return getJSON(`/project/${project._id}/invites`)
}
