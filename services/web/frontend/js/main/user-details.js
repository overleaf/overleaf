/* eslint-disable
    handle-callback-err,
    max-len,
    no-return-assign,
    no-undef,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
define(['base', 'libs/algolia-2.5.2'], function(App, algolia) {
  App.factory('Institutions', () =>
    new AlgoliaSearch(
      window.algolia.institutions.app_id,
      window.algolia.institutions.api_key
    ).initIndex('institutions')
  )

  App.controller('UserProfileController', function($scope, $modal, $http) {
    $scope.institutions = []
    $http.get('/user/personal_info').then(function(response) {
      const { data } = response
      return ($scope.userInfoForm = {
        first_name: data.first_name || '',
        last_name: data.last_name || '',
        role: data.role || '',
        institution: data.institution || '',
        _csrf: window.csrfToken
      })
    })

    $scope.showForm = function() {
      GrooveWidget.toggle()
      return ($scope.formVisable = true)
    }

    $scope.getPercentComplete = function() {
      const results = _.filter(
        $scope.userInfoForm,
        value =>
          value == null || (value != null ? value.length : undefined) !== 0
      )
      return results.length * 20
    }

    $scope.$watch(
      'userInfoForm',
      function(value) {
        if (value != null) {
          return ($scope.percentComplete = $scope.getPercentComplete())
        }
      },
      true
    )

    return ($scope.openUserProfileModal = () =>
      $modal.open({
        templateUrl: 'userProfileModalTemplate',
        controller: 'UserProfileModalController',
        scope: $scope
      }))
  })

  return App.controller('UserProfileModalController', function(
    $scope,
    $modalInstance,
    $http,
    Institutions
  ) {
    $scope.roles = [
      'Student',
      'Post-graduate student',
      'Post-doctoral researcher',
      'Lecturer',
      'Professor'
    ]

    $modalInstance.result.finally(() => sendUpdate())

    var sendUpdate = function() {
      const request = $http.post('/user/settings', $scope.userInfoForm)
      request.then(function() {})
      return request.catch(() => console.log('the request failed'))
    }

    $scope.updateInstitutionsList = function(inputVal) {
      const query = $scope.userInfoForm.institution
      if ((query != null ? query.length : undefined) <= 3) {
        return // saves us algolia searches
      }

      return Institutions.search(
        $scope.userInfoForm.institution,
        (err, response) =>
          ($scope.institutions = _.map(
            response.hits,
            institution => `${institution.name} (${institution.domain})`
          ))
      )
    }

    return ($scope.done = () => $modalInstance.close())
  })
})
