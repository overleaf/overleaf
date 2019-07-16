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
  App.controller('HistoryV2DeleteLabelModalController', function(
    $scope,
    $modalInstance,
    ide,
    labelDetails
  ) {
    $scope.labelDetails = labelDetails
    $scope.state = {
      inflight: false,
      error: false
    }

    return ($scope.deleteLabel = function() {
      $scope.state.inflight = true
      return ide.historyManager
        .deleteLabel(labelDetails)
        .then(function(response) {
          $scope.state.inflight = false
          return $modalInstance.close()
        })
        .catch(function(response) {
          const { data, status } = response
          $scope.state.inflight = false
          if (status === 400) {
            return ($scope.state.error = { message: data })
          } else {
            return ($scope.state.error = true)
          }
        })
    })
  }))
