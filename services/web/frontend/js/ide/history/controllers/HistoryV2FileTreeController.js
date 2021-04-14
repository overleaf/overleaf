/* eslint-disable
    max-len,
    no-return-assign,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
import App from '../../../base'

export default App.controller(
  'HistoryV2FileTreeController',
  function ($scope, ide) {
    $scope.handleFileSelection = file => {
      ide.historyManager.selectFile(file)
    }
  }
)
