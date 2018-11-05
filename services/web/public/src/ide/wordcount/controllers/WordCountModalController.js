/* eslint-disable
    max-len,
    no-return-assign,
    no-undef,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
define(['base'], App =>
  App.controller('WordCountModalController', function(
    $scope,
    $modalInstance,
    ide,
    $http
  ) {
    $scope.status = { loading: true }

    const opts = {
      url: `/project/${ide.project_id}/wordcount`,
      method: 'GET',
      params: {
        clsiserverid: ide.clsiServerId
      }
    }
    $http(opts)
      .then(function(response) {
        const { data } = response
        $scope.status.loading = false
        return ($scope.data = data.texcount)
      })
      .catch(() => ($scope.status.error = true))

    return ($scope.cancel = () => $modalInstance.dismiss('cancel'))
  }))
