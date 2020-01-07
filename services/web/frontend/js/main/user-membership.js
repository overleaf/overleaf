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
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
define(['base'], function(App) {
  App.controller('UserMembershipController', function($scope, queuedHttp) {
    $scope.users = window.users
    $scope.groupSize = window.groupSize
    $scope.paths = window.paths
    $scope.selectedUsers = []

    $scope.inputs = {
      addMembers: {
        content: '',
        error: false,
        errorMessage: null,
        inflightCount: 0
      },
      removeMembers: {
        error: false,
        errorMessage: null
      }
    }

    const parseEmails = function(emailsString) {
      const regexBySpaceOrComma = /[\s,]+/
      let emails = emailsString.split(regexBySpaceOrComma)
      emails = _.map(emails, email => (email = email.trim()))
      emails = _.filter(emails, email => email.indexOf('@') !== -1)
      return emails
    }

    $scope.addMembers = function() {
      $scope.inputs.addMembers.error = false
      $scope.inputs.addMembers.errorMessage = null
      $scope.inputs.addMembers.inflightCount = 0
      const emails = parseEmails($scope.inputs.addMembers.content)
      return Array.from(emails).map(email => {
        $scope.inputs.addMembers.inflightCount += 1
        return queuedHttp
          .post(paths.addMember, {
            email,
            _csrf: window.csrfToken
          })
          .then(function(response) {
            $scope.inputs.addMembers.inflightCount -= 1
            const { data } = response
            if (data.user != null) {
              $scope.users.push(data.user)
            }
            return ($scope.inputs.addMembers.content = '')
          })
          .catch(function(response) {
            $scope.inputs.addMembers.inflightCount -= 1
            const { data } = response
            $scope.inputs.addMembers.error = true
            return ($scope.inputs.addMembers.errorMessage =
              data.error != null ? data.error.message : undefined)
          })
      })
    }

    $scope.removeMembers = function() {
      $scope.inputs.removeMembers.error = false
      $scope.inputs.removeMembers.errorMessage = null
      for (let user of Array.from($scope.selectedUsers)) {
        ;(function(user) {
          let url
          if (paths.removeInvite && user.invite && user._id == null) {
            url = `${paths.removeInvite}/${encodeURIComponent(user.email)}`
          } else if (paths.removeMember && user._id != null) {
            url = `${paths.removeMember}/${user._id}`
          } else {
            return
          }
          return queuedHttp({
            method: 'DELETE',
            url,
            headers: {
              'X-Csrf-Token': window.csrfToken
            }
          })
            .then(function() {
              const index = $scope.users.indexOf(user)
              if (index === -1) {
                return
              }
              return $scope.users.splice(index, 1)
            })
            .catch(function(response) {
              const { data } = response
              $scope.inputs.removeMembers.error = true
              return ($scope.inputs.removeMembers.errorMessage =
                data.error != null ? data.error.message : undefined)
            })
        })(user)
      }
      return $scope.updateSelectedUsers
    }

    return ($scope.updateSelectedUsers = () =>
      ($scope.selectedUsers = $scope.users.filter(user => user.selected)))
  })

  return App.controller('UserMembershipListItemController', $scope =>
    $scope.$watch('user.selected', function(value) {
      if (value != null) {
        return $scope.updateSelectedUsers()
      }
    })
  )
})
