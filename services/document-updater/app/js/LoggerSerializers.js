/* eslint-disable
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
const _ = require('lodash')

const showLength = function (thing) {
  if (thing != null ? thing.length : undefined) {
    return thing.length
  } else {
    return thing
  }
}

const showUpdateLength = function (update) {
  if ((update != null ? update.op : undefined) instanceof Array) {
    const copy = _.cloneDeep(update)
    copy.op.forEach(function (element, index) {
      if (element?.i?.length != null) {
        copy.op[index].i = element.i.length
      }
      if (element?.d?.length != null) {
        copy.op[index].d = element.d.length
      }
      if (element?.c?.length != null) {
        return (copy.op[index].c = element.c.length)
      }
    })
    return copy
  } else {
    return update
  }
}

module.exports = {
  // replace long values with their length
  lines: showLength,
  oldLines: showLength,
  newLines: showLength,
  docLines: showLength,
  newDocLines: showLength,
  ranges: showLength,
  update: showUpdateLength,
}
