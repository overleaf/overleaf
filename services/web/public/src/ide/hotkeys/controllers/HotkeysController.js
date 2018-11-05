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
define(['base', 'ace/ace'], function(App) {
  App.controller(
    'HotkeysController',
    ($scope, $modal, event_tracking) =>
      ($scope.openHotkeysModal = function() {
        event_tracking.sendMB('ide-open-hotkeys-modal')

        return $modal.open({
          templateUrl: 'hotkeysModalTemplate',
          controller: 'HotkeysModalController',
          size: 'lg',
          resolve: {
            trackChangesVisible() {
              return $scope.project.features.trackChangesVisible
            }
          }
        })
      })
  )

  return App.controller('HotkeysModalController', function(
    $scope,
    $modalInstance,
    trackChangesVisible
  ) {
    $scope.trackChangesVisible = trackChangesVisible
    if (ace.require('ace/lib/useragent').isMac) {
      $scope.ctrl = 'Cmd'
    } else {
      $scope.ctrl = 'Ctrl'
    }

    return ($scope.cancel = () => $modalInstance.dismiss())
  })
})
