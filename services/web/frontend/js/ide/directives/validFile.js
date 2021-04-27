/* eslint-disable
    max-len,
    no-return-assign,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
import App from '../../base'
import SafePath from './SafePath'

export default App.directive('validFile', () => ({
  require: 'ngModel',
  link(scope, element, attrs, ngModelCtrl) {
    return (ngModelCtrl.$validators.validFile = filename =>
      SafePath.isCleanFilename(filename))
  },
}))
