/* eslint-disable
    camelcase,
    max-len,
    no-return-assign,
    no-undef,
*/
define(['base', 'ide/history/util/displayNameForUser'], function(
  App,
  displayNameForUser
) {
  App.controller('HistoryCompareController', [
    '$scope',
    '$modal',
    'ide',
    '_',
    function($scope, $modal, ide, _) {
      $scope.projectUsers = []
      $scope.versionsWithLabels = []

      $scope.$watch('project.members', function(newVal) {
        if (newVal != null) {
          $scope.projectUsers = newVal.concat($scope.project.owner)
        }
      })

      $scope.$watchCollection('history.labels', function(labels) {
        if (labels != null && labels.length > 0) {
          const groupedLabelsHash = _.groupBy(labels, 'version')
          $scope.versionsWithLabels = _.map(
            groupedLabelsHash,
            (labels, version) => {
              return {
                version: parseInt(version, 10),
                labels
              }
            }
          )
        }
      })

      $scope.loadMore = () => ide.historyManager.fetchNextBatchOfUpdates()

      $scope.setHoverFrom = fromV => ide.historyManager.setHoverFrom(fromV)

      $scope.setHoverTo = toV => ide.historyManager.setHoverTo(toV)

      $scope.resetHover = () => ide.historyManager.resetHover()

      $scope.select = (toV, fromV) => {
        $scope.history.selection.range.toV = toV
        $scope.history.selection.range.fromV = fromV
      }

      $scope.addLabelVersionToSelection = version => {
        ide.historyManager.expandSelectionToVersion(version)
      }

      // This method (and maybe the one below) will be removed soon. User details data will be
      // injected into the history API responses, so we won't need to fetch user data from other
      // local data structures.
      $scope.getUserById = id =>
        _.find($scope.projectUsers, function(user) {
          let curUserId
          if (user) {
            curUserId = user._id || user.id
          }
          return curUserId === id
        })

      $scope.getDisplayNameById = id =>
        displayNameForUser($scope.getUserById(id))

      $scope.deleteLabel = labelDetails =>
        $modal.open({
          templateUrl: 'historyV2DeleteLabelModalTemplate',
          controller: 'HistoryV2DeleteLabelModalController',
          resolve: {
            labelDetails() {
              return labelDetails
            }
          }
        })
    }
  ])
})
