import App from '../../../base'
import { react2angular } from 'react2angular'
import _ from 'lodash'

import { rootContext } from '../../../shared/context/root-context'
import FileView from '../components/file-view'

export default App.controller('FileViewController', [
  '$scope',
  '$rootScope',
  function ($scope, $rootScope) {
    $scope.file = $scope.openFile

    $scope.storeReferencesKeys = newKeys => {
      const oldKeys = $rootScope._references.keys
      return ($rootScope._references.keys = _.union(oldKeys, newKeys))
    }
  },
])

App.component(
  'fileView',
  react2angular(rootContext.use(FileView), ['storeReferencesKeys', 'file'])
)
