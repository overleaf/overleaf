/* eslint-disable
    max-len,
    no-return-assign,
    no-undef,
    camelcase,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
define(['base'], App =>
  App.controller(
    'HistoryV2ToolbarController',
    ($scope, $modal, ide, event_tracking, waitFor) => {
      let openEntity

      $scope.currentUpdate = null
      $scope.currentLabel = null

      $scope.restoreState = {
        inflight: false,
        error: false
      }

      $scope.toolbarUIConfig = {
        showOnlyLabels: false
      }

      let _deregistershowOnlyLabelsWatcher = $scope.$watch(
        'history.showOnlyLabels',
        showOnlyLabels => {
          if (showOnlyLabels != null) {
            $scope.toolbarUIConfig.showOnlyLabels = showOnlyLabels
            _deregistershowOnlyLabelsWatcher()
          }
        }
      )

      $scope.$watch('toolbarUIConfig.showOnlyLabels', (newVal, oldVal) => {
        if (newVal != null && newVal !== oldVal) {
          if (newVal) {
            ide.historyManager.showOnlyLabels()
          } else {
            ide.historyManager.showAllUpdates()
          }
        }
      })

      $scope.$watch('history.viewMode', (newVal, oldVal) => {
        if (newVal != null && newVal !== oldVal) {
          $scope.currentUpdate = ide.historyManager.getUpdateForVersion(newVal)
        }
      })

      $scope.$watch('history.selection.range.toV', (newVal, oldVal) => {
        if (
          newVal != null &&
          newVal !== oldVal &&
          $scope.history.viewMode === $scope.HistoryViewModes.POINT_IN_TIME
        ) {
          $scope.currentUpdate = ide.historyManager.getUpdateForVersion(newVal)
        }
      })

      $scope.toggleHistoryViewMode = () => {
        ide.historyManager.toggleHistoryViewMode()
      }

      $scope.restoreDeletedFile = function() {
        const { pathname, deletedAtV } = $scope.history.selection.file
        if (pathname == null || deletedAtV == null) {
          return
        }

        event_tracking.sendMB('history-v2-restore-deleted')
        $scope.restoreState.inflight = true
        return ide.historyManager
          .restoreFile(deletedAtV, pathname)
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

      $scope.showAddLabelDialog = () => {
        $modal.open({
          templateUrl: 'historyV2AddLabelModalTemplate',
          controller: 'HistoryV2AddLabelModalController',
          resolve: {
            update() {
              return $scope.history.selection.update
            }
          }
        })
      }

      openEntity = function(data) {
        const { id, type } = data
        return waitFor(() => ide.fileTreeManager.findEntityById(id), 3000)
          .then(function(entity) {
            if (type === 'doc') {
              ide.editorManager.openDoc(entity)
              this.ide.$timeout(() => {
                this.$scope.$broadcast('history:toggle')
              }, 0)
            } else if (type === 'file') {
              ide.binaryFilesManager.openFile(entity)
              this.ide.$timeout(() => {
                this.$scope.$broadcast('history:toggle')
              }, 0)
            }
          })
          .catch(err => console.warn(err))
      }
    }
  ))
