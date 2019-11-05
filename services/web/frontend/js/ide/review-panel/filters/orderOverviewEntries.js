/* eslint-disable
    no-undef,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
define(['base'], App =>
  App.filter(
    'orderOverviewEntries',
    () =>
      function(items) {
        const array = []
        for (let key in items) {
          const value = items[key]
          value.entry_id = key
          array.push(value)
        }
        array.sort((a, b) => a.offset - b.offset)
        return array
      }
  ))
