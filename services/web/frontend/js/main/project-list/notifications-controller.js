import App from '../../base'
import getMeta from '../../utils/meta'

const ExposedSettings = window.ExposedSettings
App.controller('NotificationsController', function ($scope, $http) {
  for (const notification of $scope.notifications || []) {
    notification.hide = false
  }

  $scope.samlInitPath = ExposedSettings.samlInitPath

  $scope.dismiss = notification => {
    if (!notification._id) {
      notification.hide = true
      return
    }
    $http({
      url: `/notifications/${notification._id}`,
      method: 'DELETE',
      headers: {
        'X-Csrf-Token': window.csrfToken,
      },
    }).then(() => (notification.hide = true))
  }
})

App.controller(
  'GroupsAndEnterpriseBannerController',
  function ($scope, localStorage) {
    $scope.hasDismissedGroupsAndEnterpriseBanner = localStorage(
      'has_dismissed_groups_and_enterprise_banner'
    )

    $scope.dismiss = () => {
      localStorage('has_dismissed_groups_and_enterprise_banner', true)
      $scope.hasDismissedGroupsAndEnterpriseBanner = true
    }

    $scope.groupsAndEnterpriseBannerVariant = getMeta(
      'ol-groupsAndEnterpriseBannerVariant'
    )

    $scope.isVariantValid =
      $scope.groupsAndEnterpriseBannerVariant === 'save' ||
      $scope.groupsAndEnterpriseBannerVariant === 'empower' ||
      $scope.groupsAndEnterpriseBannerVariant === 'did-you-know'
  }
)

App.controller('ProjectInviteNotificationController', function ($scope, $http) {
  // Shortcuts for translation keys
  $scope.projectName = $scope.notification.messageOpts.projectName
  $scope.userName = $scope.notification.messageOpts.userName

  $scope.accept = function () {
    $scope.notification.inflight = true
    return $http({
      url: `/project/${$scope.notification.messageOpts.projectId}/invite/token/${$scope.notification.messageOpts.token}/accept`,
      method: 'POST',
      headers: {
        'X-Csrf-Token': window.csrfToken,
        'X-Requested-With': 'XMLHttpRequest',
      },
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
  }
})

App.controller(
  'EmailNotificationController',
  function ($scope, $http, UserAffiliationsDataService) {
    $scope.userEmails = window.data.userEmails
    const _ssoAvailable = email => {
      if (!ExposedSettings.hasSamlFeature) return false
      if (email.samlProviderId) return true
      if (!email.affiliation || !email.affiliation.institution) return false
      if (email.affiliation.institution.ssoEnabled) return true
      if (
        ExposedSettings.hasSamlBeta &&
        email.affiliation.institution.ssoBeta
      ) {
        return true
      }
      return false
    }
    $scope.showConfirmEmail = email => {
      if (ExposedSettings.emailConfirmationDisabled) {
        return false
      }
      if (!email.confirmedAt && !email.hide) {
        if (_ssoAvailable(email)) {
          return false
        }
        return true
      }
      return false
    }
    for (const userEmail of $scope.userEmails) {
      userEmail.hide = false
    }

    $scope.resendConfirmationEmail = function (userEmail) {
      userEmail.confirmationInflight = true
      userEmail.error = false
      userEmail.errorMessage = null
      UserAffiliationsDataService.resendConfirmationEmail(userEmail.email)
        .then(() => {
          userEmail.hide = true
          $scope.$emit('project-list:notifications-received')
        })
        .catch(error => {
          userEmail.error = true
          userEmail.errorMessage = error.data.message
          console.error(error)
          $scope.$emit('project-list:notifications-received')
        })
        .finally(() => {
          userEmail.confirmationInflight = false
        })
    }
  }
)
