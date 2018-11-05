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
  App.controller('HistoryV2ToolbarController', [
    '$scope',
    '$modal',
    'ide',
    ($scope, $modal, ide) =>
      ($scope.showAddLabelDialog = () =>
        $modal.open({
          templateUrl: 'historyV2AddLabelModalTemplate',
          controller: 'HistoryV2AddLabelModalController',
          resolve: {
            update() {
              return $scope.history.selection.updates[0]
            }
          }
        }))
  ]))
