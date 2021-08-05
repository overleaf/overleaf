/* eslint-disable
    max-len,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const rx = /INPUT|SELECT|TEXTAREA/i

export default $(document).bind('keydown keypress', function (e) {
  if (e.which === 8) {
    // 8 == backspace
    if (!rx.test(e.target.tagName) || e.target.disabled || e.target.readOnly) {
      return e.preventDefault()
    }
  }
})
