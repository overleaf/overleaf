/* eslint-disable
    max-len,
    no-return-assign,
    no-undef,
    no-unused-vars,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
define([], function() {
  let displayNameForUser
  return (displayNameForUser = function(user) {
    if (user == null) {
      return 'Anonymous'
    }
    if (user.id === window.user.id) {
      return 'you'
    }
    if (user.name != null) {
      return user.name
    }
    let name = [user.first_name, user.last_name]
      .filter(n => n != null)
      .join(' ')
      .trim()
    if (name === '') {
      name = user.email.split('@')[0]
    }
    if (name == null || name === '') {
      return '?'
    }
    return name
  })
})
