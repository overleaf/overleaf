/* eslint-disable
    no-return-assign,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
import App from '../../../base'

export default App.controller(
  'CloneProjectController',
  ($scope, $modal) =>
    ($scope.openCloneProjectModal = () =>
      $modal.open({
        templateUrl: 'cloneProjectModalTemplate',
        controller: 'CloneProjectModalController',
      }))
)
