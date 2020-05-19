/* eslint-disable
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

export default App.filter(
  'numKeys',
  () =>
    function(object) {
      if (object != null) {
        return Object.keys(object).length
      } else {
        return 0
      }
    }
)
