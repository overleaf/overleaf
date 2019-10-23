/* eslint-disable
    camelcase,
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
define(['base'], function(App) {
  App.controller('HistoryDiffController', function(
    $scope,
    $modal,
    ide,
    eventTracking
  ) {
    $scope.restoreDeletedDoc = function() {
      eventTracking.sendMB('history-restore-deleted')
      $scope.history.diff.restoreInProgress = true
      return ide.historyManager
        .restoreDeletedDoc($scope.history.diff.doc)
        .then(function(response) {
          const { data } = response
          $scope.history.diff.restoredDocNewId = data.doc_id
          $scope.history.diff.restoreInProgress = false
          return ($scope.history.diff.restoreDeletedSuccess = true)
        })
    }

    $scope.openRestoreDiffModal = function() {
      eventTracking.sendMB('history-restore-modal')
      return $modal.open({
        templateUrl: 'historyRestoreDiffModalTemplate',
        controller: 'HistoryRestoreDiffModalController',
        resolve: {
          diff() {
            return $scope.history.diff
          }
        }
      })
    }

    return ($scope.backToEditorAfterRestore = () =>
      ide.editorManager.openDoc({ id: $scope.history.diff.restoredDocNewId }))
  })

  return App.controller('HistoryRestoreDiffModalController', function(
    $scope,
    $modalInstance,
    diff,
    ide,
    eventTracking
  ) {
    $scope.state = { inflight: false }

    $scope.diff = diff

    $scope.restore = function() {
      eventTracking.sendMB('history-restored')
      $scope.state.inflight = true
      return ide.historyManager.restoreDiff(diff).then(function() {
        $scope.state.inflight = false
        $modalInstance.close()
        return ide.editorManager.openDoc(diff.doc)
      })
    }

    return ($scope.cancel = () => $modalInstance.dismiss())
  })
})
