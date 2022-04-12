import App from '../../../base'
import { react2angular } from 'react2angular'
import { cloneDeep } from 'lodash'

import FileTreeRoot from '../components/file-tree-root'
import { rootContext } from '../../../shared/context/root-context'

App.controller(
  'ReactFileTreeController',
  function (
    $scope,
    $timeout,
    ide
    // eventTracking
  ) {
    $scope.isConnected = true

    $scope.$on('project:joined', () => {
      $scope.$emit('file-tree:initialized')
    })

    $scope.$watch('editor.open_doc_id', openDocId => {
      window.dispatchEvent(
        new CustomEvent('editor.openDoc', { detail: openDocId })
      )
    })

    $scope.$on('file-tree.reselectDoc', (ev, docId) => {
      window.dispatchEvent(new CustomEvent('editor.openDoc', { detail: docId }))
    })

    // Set isConnected to true if:
    // - connection state is 'ready', OR
    // - connection state is 'waitingCountdown' and reconnection_countdown is null
    // The added complexity is needed  because in Firefox on page reload the
    // connection state goes into 'waitingCountdown' before being hidden and we
    // don't want to show a disconnect UI.
    function updateIsConnected() {
      const isReady = $scope.connection.state === 'ready'
      const willStartCountdown =
        $scope.connection.state === 'waitingCountdown' &&
        $scope.connection.reconnection_countdown === null
      $scope.isConnected = isReady || willStartCountdown
    }

    $scope.$watch('connection.state', updateIsConnected)
    $scope.$watch('connection.reconnection_countdown', updateIsConnected)

    $scope.onInit = () => {
      // HACK: resize the vertical pane on init after a 0ms timeout. We do not
      // understand why this is necessary but without this the resized handle is
      // stuck at the bottom. The vertical resize will soon be migrated to React
      // so we accept to live with this hack for now.
      $timeout(() => {
        $scope.$emit('left-pane-resize-all')
      })
    }

    $scope.onSelect = selectedEntities => {
      if (selectedEntities.length === 1) {
        const selectedEntity = selectedEntities[0]
        const type =
          selectedEntity.type === 'fileRef' ? 'file' : selectedEntity.type
        $scope.$emit('entity:selected', {
          ...selectedEntity.entity,
          id: selectedEntity.entity._id,
          type,
        })

        // in the react implementation there is no such concept as "1
        // multi-selected entity" so here we pass a count of 0
        $scope.$emit('entities:multiSelected', { count: 0 })
      } else if (selectedEntities.length > 1) {
        $scope.$emit('entities:multiSelected', {
          count: selectedEntities.length,
        })
      } else {
        $scope.$emit('entity:no-selection')
      }
    }

    $scope.refProviders = ide.$scope.user.refProviders || {}

    ide.$scope.$watch(
      'user.refProviders',
      refProviders => {
        $scope.refProviders = cloneDeep(refProviders)
      },
      true
    )

    $scope.setRefProviderEnabled = provider => {
      ide.$scope.$applyAsync(() => {
        ide.$scope.user.refProviders[provider] = true
      })
    }

    $scope.setStartedFreeTrial = started => {
      $scope.$applyAsync(() => {
        $scope.startedFreeTrial = started
      })
    }

    $scope.reindexReferences = () => {
      ide.$scope.$emit('references:should-reindex', {})
    }
  }
)

App.component(
  'fileTreeRoot',
  react2angular(
    rootContext.use(FileTreeRoot),
    Object.keys(FileTreeRoot.propTypes)
  )
)
