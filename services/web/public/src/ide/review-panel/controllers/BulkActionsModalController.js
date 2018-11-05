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
  App.controller('BulkActionsModalController', function(
    $scope,
    $modalInstance,
    isAccept,
    nChanges
  ) {
    $scope.isAccept = isAccept
    $scope.nChanges = nChanges
    $scope.cancel = () => $modalInstance.dismiss()
    return ($scope.confirm = () => $modalInstance.close(isAccept))
  }))
