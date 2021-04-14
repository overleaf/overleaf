// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
import App from '../base'

export default App.directive('onEnter', () => (scope, element, attrs) =>
  element.bind('keydown keypress', function (event) {
    if (event.which === 13) {
      scope.$apply(() => scope.$eval(attrs.onEnter, { event }))
      return event.preventDefault()
    }
  })
)
