import App from '../base'
import { debugConsole } from '@/utils/debugging'
App.controller('TokenAccessPageController', [
  '$scope',
  '$http',
  '$location',
  function ($scope, $http, $location) {
    window.S = $scope
    $scope.mode = 'accessAttempt' // 'accessAttempt' | 'v1Import' | 'requireAccept'

    $scope.v1ImportData = null
    $scope.requireAccept = null

    $scope.accessInFlight = false
    $scope.accessSuccess = false
    $scope.accessError = false

    $scope.currentPath = () => {
      return $location.path()
    }

    $scope.buildZipDownloadPath = projectId => {
      return `/overleaf/project/${projectId}/download/zip`
    }

    $scope.getProjectName = () => {
      if ($scope.v1ImportData?.name) {
        return $scope.v1ImportData.name
      } else if ($scope.requireAccept?.projectName) {
        return $scope.requireAccept.projectName
      } else {
        return 'This project'
      }
    }

    $scope.postConfirmedByUser = () => {
      $scope.post(true)
    }

    $scope.post = (confirmedByUser = false) => {
      $scope.mode = 'accessAttempt'
      const textData = $('#overleaf-token-access-data').text()
      const parsedData = JSON.parse(textData)
      const { postUrl, csrfToken } = parsedData
      $scope.accessInFlight = true
      $http({
        method: 'POST',
        url: postUrl,
        data: {
          _csrf: csrfToken,
          confirmedByUser,
          tokenHashPrefix: window.location.hash,
        },
      }).then(
        function successCallback(response) {
          $scope.accessInFlight = false
          $scope.accessError = false
          const { data } = response
          if (data.redirect) {
            const redirect = response.data.redirect
            if (!redirect) {
              debugConsole.warn(
                'no redirect supplied in success response data',
                response
              )
              $scope.accessError = true
              return
            }
            window.location.replace(redirect)
          } else if (data.v1Import) {
            $scope.mode = 'v1Import'
            $scope.v1ImportData = data.v1Import
          } else if (data.requireAccept) {
            $scope.mode = 'requireAccept'
            $scope.requireAccept = data.requireAccept
          } else {
            debugConsole.warn(
              'invalid data from server in success response',
              response
            )
            $scope.accessError = true
          }
        },
        function errorCallback(response) {
          debugConsole.warn('error response from server', response)
          $scope.accessInFlight = false
          $scope.accessError = response.status === 404 ? 'not_found' : 'error'
        }
      )
    }
  },
])
