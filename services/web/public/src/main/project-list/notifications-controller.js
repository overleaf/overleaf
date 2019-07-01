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
define(['base'], function(App) {
  App.controller('NotificationsController', function($scope, $http) {
    for (let notification of Array.from($scope.notifications)) {
      notification.hide = false
    }

    return ($scope.dismiss = notification =>
      $http({
        url: `/notifications/${notification._id}`,
        method: 'DELETE',
        headers: {
          'X-Csrf-Token': window.csrfToken
        }
      }).then(() => (notification.hide = true)))
  })

  App.controller('ProjectInviteNotificationController', function(
    $scope,
    $http
  ) {
    // Shortcuts for translation keys
    $scope.projectName = $scope.notification.messageOpts.projectName
    $scope.userName = $scope.notification.messageOpts.userName

    return ($scope.accept = function() {
      $scope.notification.inflight = true
      return $http({
        url: `/project/${
          $scope.notification.messageOpts.projectId
        }/invite/token/${$scope.notification.messageOpts.token}/accept`,
        method: 'POST',
        headers: {
          'X-Csrf-Token': window.csrfToken,
          'X-Requested-With': 'XMLHttpRequest'
        }
      })
        .then(() => {
          $scope.notification.accepted = true
        })
        .catch(({ status }) => {
          if (status === 404) {
            // 404 probably means the invite has already been accepted and
            // deleted. Treat as success
            $scope.notification.accepted = true
          } else {
            $scope.notification.error = true
          }
        })
        .finally(() => {
          $scope.notification.inflight = false
        })
    })
  })

  App.controller('OverleafV2NotificationController', function(
    $scope,
    localStorage
  ) {
    $scope.visible = !localStorage('overleaf_v2_2_notification_hidden_at')

    return ($scope.dismiss = function() {
      $scope.visible = false
      return localStorage('overleaf_v2_2_notification_hidden_at', Date.now())
    })
  })

  App.controller('OverleafV1NotificationController', function(
    $scope,
    localStorage
  ) {
    $scope.visible = !localStorage('overleaf_v1_notification_hidden_at')

    return ($scope.toggle = function() {
      $scope.visible = !$scope.visible
      if (!$scope.visible) {
        return localStorage('overleaf_v1_notification_hidden_at', Date.now())
      } else {
        return localStorage('overleaf_v1_notification_hidden_at', null)
      }
    })
  })

  return App.controller('EmailNotificationController', function(
    $scope,
    $http,
    UserAffiliationsDataService
  ) {
    $scope.userEmails = []
    for (let userEmail of Array.from($scope.userEmails)) {
      userEmail.hide = false
    }

    const _getUserEmails = () =>
      UserAffiliationsDataService.getUserEmails().then(function(emails) {
        $scope.userEmails = emails
        return $scope.$emit('project-list:notifications-received')
      })
    _getUserEmails()

    return ($scope.resendConfirmationEmail = function(userEmail) {
      userEmail.confirmationInflight = true
      return UserAffiliationsDataService.resendConfirmationEmail(
        userEmail.email
      ).then(function() {
        userEmail.hide = true
        userEmail.confirmationInflight = false
        return $scope.$emit('project-list:notifications-received')
      })
    })
  })
})
