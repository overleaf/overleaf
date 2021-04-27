import App from '../base'
App.controller(
  'TokenAccessPageController',
  ($scope, $http, $location, localStorage) => {
    window.S = $scope
    $scope.mode = 'accessAttempt' // 'accessAttempt' | 'v1Import'

    $scope.v1ImportData = null

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
      if (!$scope.v1ImportData || !$scope.v1ImportData.name) {
        return 'This project'
      } else {
        return $scope.v1ImportData.name
      }
    }

    $scope.post = () => {
      $scope.mode = 'accessAttempt'
      const textData = $('#overleaf-token-access-data').text()
      let parsedData = JSON.parse(textData)
      const { postUrl, csrfToken } = parsedData
      $scope.accessInFlight = true

      $http({
        method: 'POST',
        url: postUrl,
        data: {
          _csrf: csrfToken,
        },
      }).then(
        function successCallback(response) {
          $scope.accessInFlight = false
          $scope.accessError = false
          const { data } = response
          if (data.redirect) {
            const redirect = response.data.redirect
            if (!redirect) {
              console.warn(
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
          } else {
            console.warn(
              'invalid data from server in success response',
              response
            )
            $scope.accessError = true
          }
        },
        function errorCallback(response) {
          console.warn('error response from server', response)
          $scope.accessInFlight = false
          $scope.accessError = response.status === 404 ? 'not_found' : 'error'
        }
      )
    }
  }
)
