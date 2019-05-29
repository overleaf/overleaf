/* eslint-disable
    handle-callback-err,
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
let UserMembershipViewModel
const { ObjectId } = require('mongojs')
const UserGetter = require('../User/UserGetter')

module.exports = UserMembershipViewModel = {
  build(userOrEmail) {
    if (userOrEmail._id) {
      return buildUserViewModel(userOrEmail)
    } else {
      return buildUserViewModelWithEmail(userOrEmail)
    }
  },

  buildAsync(userOrIdOrEmail, callback) {
    if (callback == null) {
      callback = function(error, viewModel) {}
    }
    if (!(userOrIdOrEmail instanceof ObjectId)) {
      // userOrIdOrEmail is a user or an email and can be parsed by #build
      return callback(null, UserMembershipViewModel.build(userOrIdOrEmail))
    }

    const userId = userOrIdOrEmail
    const projection = { email: 1, first_name: 1, last_name: 1 }
    return UserGetter.getUserOrUserStubById(userId, projection, function(
      error,
      user,
      isStub
    ) {
      if (error != null || user == null) {
        return callback(null, buildUserViewModelWithId(userId.toString()))
      }
      if (isStub) {
        return callback(null, buildUserViewModelWithStub(user))
      }
      return callback(null, buildUserViewModel(user))
    })
  }
}

var buildUserViewModel = function(user, isInvite) {
  if (isInvite == null) {
    isInvite = false
  }
  return {
    _id: user._id || null,
    email: user.email || null,
    first_name: user.first_name || null,
    last_name: user.last_name || null,
    invite: isInvite
  }
}

var buildUserViewModelWithEmail = email => buildUserViewModel({ email }, true)

var buildUserViewModelWithStub = user =>
  // user stubs behave as invites
  buildUserViewModel(user, true)

var buildUserViewModelWithId = id => buildUserViewModel({ _id: id }, false)
