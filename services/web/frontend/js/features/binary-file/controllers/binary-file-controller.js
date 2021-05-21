import App from '../../../base'
import { react2angular } from 'react2angular'
import _ from 'lodash'

import BinaryFile from '../components/binary-file'

export default App.controller(
  'ReactBinaryFileController',
  function ($scope, $rootScope) {
    $scope.file = $scope.openFile

    $scope.storeReferencesKeys = newKeys => {
      const oldKeys = $rootScope._references.keys
      return ($rootScope._references.keys = _.union(oldKeys, newKeys))
    }
  }
)

App.component(
  'binaryFile',
  react2angular(BinaryFile, ['storeReferencesKeys', 'file'])
)
