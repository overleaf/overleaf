/* eslint-disable
    n/handle-callback-err,
    max-len,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const UserGetter = require('../User/UserGetter')
const { isObjectIdInstance } = require('../Helpers/Mongo')
const { promisify } = require('@overleaf/promise-utils')

const UserMembershipViewModel = {
  build(userOrEmail) {
    if (userOrEmail._id) {
      return buildUserViewModel(userOrEmail)
    } else {
      return buildUserViewModelWithEmail(userOrEmail)
    }
  },

  buildAsync(userOrIdOrEmail, callback) {
    if (callback == null) {
      callback = function () {}
    }
    if (!isObjectIdInstance(userOrIdOrEmail)) {
      // userOrIdOrEmail is a user or an email and can be parsed by #build
      return callback(null, UserMembershipViewModel.build(userOrIdOrEmail))
    }

    const userId = userOrIdOrEmail
    const projection = {
      email: 1,
      first_name: 1,
      last_name: 1,
      lastLoggedIn: 1,
      lastActive: 1,
      enrollment: 1,
    }
    return UserGetter.getUser(userId, projection, function (error, user) {
      if (error != null || user == null) {
        return callback(null, buildUserViewModelWithId(userId.toString()))
      }
      return callback(null, buildUserViewModel(user))
    })
  },
}

function buildUserViewModel(user, isInvite) {
  if (isInvite == null) {
    isInvite = false
  }
  return {
    _id: user._id || null,
    email: user.email || null,
    first_name: user.first_name || null,
    last_name: user.last_name || null,
    last_active_at: user.lastActive || user.lastLoggedIn || null,
    last_logged_in_at: user.lastLoggedIn || null,
    invite: isInvite,
    enrollment: user.enrollment
      ? {
          managedBy: user.enrollment.managedBy,
          enrolledAt: user.enrollment.enrolledAt,
          sso: user.enrollment.sso,
        }
      : undefined,
  }
}

const buildUserViewModelWithEmail = email => buildUserViewModel({ email }, true)

const buildUserViewModelWithId = id => buildUserViewModel({ _id: id }, false)

UserMembershipViewModel.promises = {
  buildAsync: promisify(UserMembershipViewModel.buildAsync),
}

module.exports = UserMembershipViewModel
