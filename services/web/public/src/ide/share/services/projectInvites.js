/* eslint-disable
    max-len,
    no-undef,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
define(['base'], App =>
  App.factory('projectInvites', (ide, $http) => ({
    sendInvite(email, privileges, grecaptchaResponse) {
      return $http.post(`/project/${ide.project_id}/invite`, {
        email,
        privileges,
        _csrf: window.csrfToken,
        'g-recaptcha-response': grecaptchaResponse
      })
    },

    revokeInvite(inviteId) {
      return $http({
        url: `/project/${ide.project_id}/invite/${inviteId}`,
        method: 'DELETE',
        headers: {
          'X-Csrf-Token': window.csrfToken
        }
      })
    },

    resendInvite(inviteId, privileges) {
      return $http.post(
        `/project/${ide.project_id}/invite/${inviteId}/resend`,
        {
          _csrf: window.csrfToken
        }
      )
    },

    getInvites() {
      return $http.get(`/project/${ide.project_id}/invites`, {
        json: true,
        headers: {
          'X-Csrf-Token': window.csrfToken
        }
      })
    }
  })))
