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
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
define(['base'], App =>
  App.controller('HistoryV2DiffController', function(
    $scope,
    ide,
    event_tracking,
    waitFor
  ) {
    let openEntity
    $scope.restoreState = {
      inflight: false,
      error: false
    }

    $scope.restoreDeletedFile = function() {
      const { pathname } = $scope.history.selection
      if (pathname == null) {
        return
      }
      const version =
        $scope.history.selection.docs[pathname] != null
          ? $scope.history.selection.docs[pathname].deletedAtV
          : undefined
      if (version == null) {
        return
      }
      event_tracking.sendMB('history-v2-restore-deleted')
      $scope.restoreState.inflight = true
      return ide.historyManager
        .restoreFile(version, pathname)
        .then(function(response) {
          const { data } = response
          return openEntity(data)
        })
        .catch(() =>
          ide.showGenericMessageModal(
            'Sorry, something went wrong with the restore'
          )
        )
        .finally(() => ($scope.restoreState.inflight = false))
    }

    return (openEntity = function(data) {
      const { id, type } = data
      return waitFor(() => ide.fileTreeManager.findEntityById(id), 3000)
        .then(function(entity) {
          if (type === 'doc') {
            return ide.editorManager.openDoc(entity)
          } else if (type === 'file') {
            return ide.binaryFilesManager.openFile(entity)
          }
        })
        .catch(err => console.warn(err))
    })
  }))
