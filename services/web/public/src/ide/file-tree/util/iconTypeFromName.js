/* eslint-disable
    max-len,
    no-return-assign,
    no-undef,
    no-unused-vars,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS103: Rewrite code to no longer use __guard__
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
define([], function() {
  let iconTypeFromName
  return (iconTypeFromName = function(name) {
    const ext = __guard__(name.split('.').pop(), x => x.toLowerCase())
    if (['png', 'pdf', 'jpg', 'jpeg', 'gif'].includes(ext)) {
      return 'image'
    } else if (['csv', 'xls', 'xlsx'].includes(ext)) {
      return 'table'
    } else if (['py', 'r'].includes(ext)) {
      return 'file-text'
    } else if (['bib'].includes(ext)) {
      return 'book'
    } else {
      return 'file'
    }
  })
})
function __guard__(value, transform) {
  return typeof value !== 'undefined' && value !== null
    ? transform(value)
    : undefined
}
