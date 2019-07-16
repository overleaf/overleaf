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
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
define(['base', 'ide/history/util/displayNameForUser'], (
  App,
  displayNameForUser
) =>
  App.controller('HistoryV2ListController', function($scope, $modal, ide) {
    $scope.hoveringOverListSelectors = false
    $scope.listConfig = { showOnlyLabelled: false }

    $scope.projectUsers = []

    $scope.$watch('project.members', function(newVal) {
      if (newVal != null) {
        return ($scope.projectUsers = newVal.concat($scope.project.owner))
      }
    })

    $scope.loadMore = () => {
      return ide.historyManager.fetchNextBatchOfUpdates()
    }

    $scope.handleVersionSelect = version =>
      $scope.$applyAsync(() =>
        ide.historyManager.selectVersionForPointInTime(version)
      )

    $scope.handleRangeSelect = (selectedToV, selectedFromV) =>
      $scope.$applyAsync(() =>
        ide.historyManager.selectVersionsForCompare(selectedToV, selectedFromV)
      )

    return ($scope.handleLabelDelete = labelDetails =>
      $modal.open({
        templateUrl: 'historyV2DeleteLabelModalTemplate',
        controller: 'HistoryV2DeleteLabelModalController',
        resolve: {
          labelDetails() {
            return labelDetails
          }
        }
      }))
  }))
