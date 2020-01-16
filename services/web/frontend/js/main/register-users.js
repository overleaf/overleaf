/* eslint-disable
    max-len,
    no-return-assign,
    no-undef,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
define(['base'], App =>
  App.controller('RegisterUsersController', function($scope, queuedHttp) {
    $scope.users = []

    $scope.inputs = { emails: '' }

    const parseEmails = function(emailsString) {
      const regexBySpaceOrComma = /[\s,]+/
      let emails = emailsString.split(regexBySpaceOrComma)
      emails = _.map(emails, email => (email = email.trim()))
      emails = _.filter(emails, email => email.indexOf('@') !== -1)
      return emails
    }

    return ($scope.registerUsers = function() {
      const emails = parseEmails($scope.inputs.emails)
      $scope.error = false
      return Array.from(emails).map(email =>
        queuedHttp
          .post('/admin/register', {
            email,
            _csrf: window.csrfToken
          })
          .then(function(response) {
            const { data } = response
            const user = data
            $scope.users.push(user)
            return ($scope.inputs.emails = '')
          })
          .catch(() => ($scope.error = true))
      )
    })
  }))
