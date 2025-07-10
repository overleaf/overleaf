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

  buildAsync(userOrIdOrEmailArray, callback) {
    if (callback == null) {
      callback = function () {}
    }

    const userObjectIds = userOrIdOrEmailArray.filter(isObjectIdInstance)

    return UserGetter.getUsers(
      userObjectIds,
      {
        email: 1,
        first_name: 1,
        last_name: 1,
        lastLoggedIn: 1,
        lastActive: 1,
        enrollment: 1,
      },
      function (error, users) {
        const results = []

        if (error != null) {
          userOrIdOrEmailArray.forEach(item => {
            if (isObjectIdInstance(item)) {
              results.push(buildUserViewModelWithId(item.toString()))
            } else {
              // `item` is a user or an email and can be parsed by #build
              results.push(UserMembershipViewModel.build(item))
            }
          })
        } else {
          const usersMap = new Map()
          for (const user of users) {
            usersMap.set(user._id.toString(), user)
          }

          userOrIdOrEmailArray.forEach(item => {
            if (isObjectIdInstance(item)) {
              const user = usersMap.get(item.toString())
              if (user == null) {
                results.push(buildUserViewModelWithId(item.toString()))
              } else {
                results.push(buildUserViewModel(user))
              }
            } else {
              // `item` is a user or an email and can be parsed by #build
              results.push(UserMembershipViewModel.build(item))
            }
          })
        }

        callback(null, results)
      }
    )
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
